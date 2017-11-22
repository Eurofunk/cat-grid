import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2, SimpleChange, Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { CatGridItemEvent } from './cat-grid-item.event';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { CatGridItemConfig } from './cat-grid-item.config';
import { CatGridDragService } from '../cat-grid-drag.service';

@Component({
  selector: 'cat-grid-item',
  template: '<ng-template #componentContainer></ng-template>',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatGridItemComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @Input() config: CatGridItemConfig;
  @Input() x: number;
  @Input() y: number;
  @Input() colWidth: number;
  @Input() rowHeight: number;

  @Output() onResize = new EventEmitter<CatGridItemEvent>();
  @Output() onResizeStop = new EventEmitter<CatGridItemEvent>();
  @Output() dataChanged = new EventEmitter<any>();

  @ViewChild('componentContainer', {read: ViewContainerRef})
  private componentContainer: ViewContainerRef;

  @HostBinding('style.cursor')
  private cursor: string;

  @HostBinding('style.transform')
  private transform: string;

  @HostBinding('style.width.px')
  private elemWidth: number;

  @HostBinding('style.height.px')
  private elemHeight: number;

  private mouseUp$: Observable<MouseEvent>;
  private mouseMove$: Observable<MouseEvent>;

  private dragStart$: Observable<any>;

  private resizeStart$: Observable<any>;
  private resize$: Observable<any>;

  private destroyed$ = new Subject();

  private componentRef: ComponentRef<any>;

  constructor(private elementRef: ElementRef,
              private renderer: Renderer2,
              private changeDetectorRef: ChangeDetectorRef,
              private catGridDragService: CatGridDragService,
              private componentFactoryResolver: ComponentFactoryResolver) {
  }

  ngOnInit(): void {
    this.renderer.addClass(this.elementRef.nativeElement, 'grid-item');
    this.renderer.setStyle(this.elementRef.nativeElement, 'position', 'absolute');

    [this.dragStart$, this.resizeStart$] = Observable.fromEvent(this.elementRef.nativeElement, 'mousedown')
      .partition((e: any) => !this.canResize(e));

    this.mouseUp$ = Observable.fromEvent(this.elementRef.nativeElement, 'mouseup');
    this.mouseMove$ = Observable.fromEvent(document, 'mousemove');

    this.setSize(this.config.sizex * this.colWidth, this.config.sizey * this.rowHeight);

    this.mouseMove$.takeUntil(this.destroyed$)
      .subscribe(e => {
        this.setResizeCursor(e);
      });

    this.dragStart$
      .filter(() => this.config.draggable)
      .takeUntil(this.destroyed$)
      .subscribe((e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.catGridDragService.startDrag(this.config, e, this.elementRef.nativeElement);
        this.hide();
        this.changeDetectorRef.markForCheck();
      });

    this.resize$ = this.resizeStart$.flatMap((dragStart: MouseEvent) => this.mouseMove$.map((mm: MouseEvent) => {
      mm.preventDefault();

      const newWidth = this.elemHeight + Math.max(mm.clientX - dragStart.clientX, 100);
      const newHeight = this.elemWidth + Math.max(mm.clientY - dragStart.clientY, 100);

      return {
        newWidth,
        newHeight,
        event: mm
      };
    })
      .takeUntil(this.mouseUp$)
      .do(
        size => this.onResize.emit({x: this.config.col, y: this.config.row, width: size.newWidth, height: size.newHeight}),
        null,
        () => {
          this.onResizeStop.emit({x: this.config.col, y: this.config.row, width: this.elemWidth, height: this.elemHeight});

          if (this.componentRef.instance.catGridItemLoaded) {
            this.componentRef.instance.catGridItemLoaded(this.config);
          }
          this.changeDetectorRef.markForCheck();
        }
      ));

    this.resize$
      .takeUntil(this.destroyed$)
      .subscribe(size => {
        const type = this.setResizeCursor(size.event);

        let newWidth = this.elemWidth;
        let newHeight = this.elemHeight;

        if (type === 'both' || type === 'width') {
          newWidth = size.newWidth;
        }
        if (type === 'both' || type === 'height') {
          newHeight = size.newHeight;
        }

        this.setSize(newWidth, newHeight);
        this.changeDetectorRef.markForCheck();
      });
  }

  ngOnChanges(changes: any) {
    const config: SimpleChange = changes.config;
    if (changes.x || changes.y) {
      this.setPosition(this.x, this.y);
    }
    if (!config) {
      return;
    }
    this.applyConfigChanges(config.currentValue);
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    if (this.componentRef) {
      this.componentRef.destroy();
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.injectComponent(), 1);
  }

  applyConfigChanges(config:CatGridItemConfig) {
    if (JSON.stringify(this.config) !== JSON.stringify(config)) {
      this.config = config;
      this.setSize(config.sizex * this.colWidth, config.sizey * this.rowHeight);
      this.injectComponent();
    }
  }

  setResizeCursor(e: any): string {
    const resizeType = this.canResize(e);
    switch (resizeType) {
      case 'both':
        this.cursor = 'nwse-resize';
        break;
      case 'width':
        this.cursor = 'ew-resize';
        break;
      case 'height':
        this.cursor = 'ns-resize';
        break;
      default:
        this.cursor = 'auto';
    }
    return resizeType;
  }

  hide() {
    this.renderer.setStyle(this.elementRef.nativeElement, 'display', 'none');
  }

  show() {
    this.renderer.setStyle(this.elementRef.nativeElement, 'display', 'inline-block');
  }

  canResize(e: MouseEvent): string | null {
    if (!this.config.resizable) {
      return null;
    }

    if (e.offsetX < this.elemWidth && e.offsetX > this.elemWidth - this.config.borderSize
      && e.offsetY < this.elemHeight && e.offsetY > this.elemHeight - this.config.borderSize) {
      return 'both';
    } else if (e.offsetX < this.elemWidth && e.offsetX > this.elemWidth - this.config.borderSize) {
      return 'width';
    } else if (e.offsetY < this.elemHeight && e.offsetY > this.elemHeight - this.config.borderSize) {
      return 'height';
    }

    return null;
  }

  setPosition(left: number, top: number) {
    this.transform = `translate(${left}px, ${top}px)`;
  }

  setSize(width: number, height: number) {
    this.elemWidth = width;
    this.elemHeight = height;
  }

  injectComponent(): void {
    if (this.config.component.type === this.componentRef.componentType) {
      return;
    }
    if (this.componentRef) {
      this.componentRef.destroy();
    }
    const factory = this.componentFactoryResolver.resolveComponentFactory(this.config.component.type);
    this.componentRef = this.componentContainer.createComponent(factory);
    Object.assign(this.componentRef.instance, this.config.component.data);

    this.checkInstanceInterface(this.componentRef.instance, factory.componentType);

    if (this.componentRef.instance.catGridItemLoaded) {
      this.componentRef.instance.catGridItemLoaded(this.config);
    }

    if (this.componentRef.instance.dataChangedObservable) {
      this.componentRef.instance.dataChangedObservable().takeUntil(this.destroyed$).subscribe((data: any) => {
        this.config.component.data = data;
        this.dataChanged.emit(data);
        this.changeDetectorRef.markForCheck();
      });
    }

    if (this.componentRef.instance.configChangedObservable) {
      this.componentRef.instance.configChangedObservable().takeUntil(this.destroyed$).subscribe((config: CatGridItemConfig) => {
        this.applyConfigChanges(config);
      });
    }

    this.componentRef.changeDetectorRef.detectChanges();
    this.changeDetectorRef.markForCheck();
  }

  checkInstanceInterface(instance: any, type: Type<any>) {
    if (!instance.catGridItemLoaded || !instance.dataChangedObservable) {
      throw `${type.name} should implement ICatGridItemComponent`;
    }
  }
}
