import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

import {
  DynamicFieldRendererComponent,
  DynamicFieldSchema,
} from './dynamic-field-renderer.component';
import { DynamicMatrixTableComponent } from './resuable-table-matrix';
import { EditorComponent } from '../Components/ui/editor';
import { ReviewTableComponent } from '../Components/final-remark-observation/review-table.component';

export interface DynamicTableSchema {
  id: string;
  sectionType: 'simpleTable' | 'matrixTable';
  title: string;
  topHeaders: any[][];
  columns: any[];
  rows: any[];
  showRowActions?: boolean;
  minRows?: number;
}

export interface DynamicSectionSchema {
  id: string;
  title: string;
  sectionType: 'fields' | 'simpleTable' | 'matrixTable' | 'hybrid';
  fields: DynamicFieldSchema[];
  tables: DynamicTableSchema[];
}

@Component({
  selector: 'app-dynamic-section-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DynamicFieldRendererComponent,
    DynamicMatrixTableComponent,
     ReviewTableComponent, EditorComponent,
  ],
  template: `
    <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ">
      <h3 class="mb-3 text-base font-semibold text-slate-800">
        {{ section.title }}
      </h3>

      <div *ngIf="section.fields?.length" class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <app-dynamic-field-renderer
          *ngFor="let field of section.fields; let i = index; trackBy: trackByField"
          [field]="field"
          (fieldChange)="onFieldChange(i, $event)"
        ></app-dynamic-field-renderer>
      </div>

      <div *ngIf="section.tables?.length" class="mt-3 space-y-4">
        <div *ngFor="let table of section.tables; let tableIndex = index; trackBy: trackByTable">
          <div *ngIf="table.title" class="mb-2 text-sm font-semibold text-slate-700">
            {{ table.title }}
          </div>

          <app-dynamic-matrix-table
            [topHeaders]="table.topHeaders || []"
            [columns]="table.columns || []"
            [rows]="table.rows || []"
            [showRowActions]="!!table.showRowActions"
            [minRows]="table.minRows || 1"
            (rowsChange)="onTableRowsChange(tableIndex, $event)"
            (dataChange)="onTableDataChange(table.id, $event)"
          ></app-dynamic-matrix-table>
        </div>
      </div>
      <div *ngIf="isLastSection" class="mt-3 space-y-4">
       
      <!-- <ng-container *ngIf="currentSectionIndex === totalSections - 1"> -->
      <div p-3 >
        <div>
          <app-review-table></app-review-table>
          
        </div>
        <div>

          <app-editor [height]="250" ></app-editor>
        </div>
      </div>


    <!-- </ng-container> -->
      </div>
    </div>
  `,
})
export class DynamicSectionRendererComponent {
  @Input() section!: DynamicSectionSchema;
  @Input() isLastSection = false;
  @Output() sectionChange = new EventEmitter<DynamicSectionSchema>();
  @Output() tableDataChange = new EventEmitter<{ tableId: string; data: any[] }>();

  trackByField(index: number, item: any) {
    return item.name || index;
  }

  trackByTable(index: number, item: any) {
    return item.id || index;
  }

  onFieldChange(index: number, updatedField: DynamicFieldSchema): void {
    const updatedFields = [...this.section.fields];
    updatedFields[index] = updatedField;

    this.section = {
      ...this.section,
      fields: updatedFields,
    };

    this.sectionChange.emit(this.section);
  }

  onTableRowsChange(tableIndex: number, rows: any[]): void {
    const updatedTables = [...this.section.tables];
    updatedTables[tableIndex] = {
      ...updatedTables[tableIndex],
      rows,
    };

    this.section = {
      ...this.section,
      tables: updatedTables,
    };

    this.sectionChange.emit(this.section);
  }

  onTableDataChange(tableId: string, data: any[]): void {
    this.tableDataChange.emit({ tableId, data });
  }
}