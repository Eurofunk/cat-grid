import { Component } from '@angular/core';
import { CatGridConfig } from './lib/src/cat-grid/cat-grid.config';
import { CatGridDragService } from './lib/src/cat-grid-drag.service';
import { CatGridItemConfig } from './lib/src/cat-grid-item/cat-grid-item.config';
import { TestComponent } from './test.component';
import { ContainerComponent } from './container.component';

@Component({
  selector: 'my-app',
  template: `<h1>Hello {{name}}</h1>
  <div>drag us to the grid:
    <span [dragula]="'id'"><div [catGridDraggableDragula]="itemConfig">Test</div></span>
    <div [catGridDraggable]="containerConfig" class="draggable">Container</div>
  </div>
  <div>
    <label>dragging outside removes elements
      <input type="checkbox" [checked]="dragOutsideRemoves" (change)="dragOutsideRemoves = !dragOutsideRemoves" />
    </label>
  </div>
  <cat-grid [config]="gridConfig" [items]="items"></cat-grid>
  `,
  styles: ['.draggable,[draggable] { border: 1px solid black; width: 200px; }; ']
})
export class AppComponent {
  name = 'Angular';

  dragOutsideRemoves:boolean = false;

  gridConfig: CatGridConfig = {
    id: '1',
    maxCols: 5,
    maxRows: 5,
    colWidth: 100,
    rowHeight: 100
  };

  itemConfig: CatGridItemConfig = {
    id: '2',
    col: 2,
    row: 2,
    sizex: 4,
    sizey: 1,
    draggable: true,
    resizable: true,
    component: {
      type: TestComponent,
      data: {}
    }
  };

  containerConfig: CatGridItemConfig = {
    id: '3',
    col: 2,
    row: 2,
    sizex: 4,
    sizey: 2,
    component: {
      type: ContainerComponent,
      data: {}
    }
  };

  items: CatGridItemConfig[] = [
    this.itemConfig,
  ];

  constructor(catGridDragService:CatGridDragService) {
    console.log('subscribing');
    catGridDragService.droppedOutsideObservable().subscribe((dragResult) => {
      console.log('drag outside delets: ',this.dragOutsideRemoves);
      if (this.dragOutsideRemoves) {
        setTimeout(() => {
          this.removeElementById(dragResult.config.id);
        });
      }
    });
  }

  removeElementById(id:string) {
    let index = this.items.findIndex((item) => item.id === id);
    if (index > -1) {
      this.items.splice(index, 1);
      this.items = [...this.items];
    }
  }
}
