import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CalenderComponent } from '../Components/ui/calender.component';
import { InputComponent } from '../Components/ui/input.component';
import { SelectOption, SelectComponent } from '../Components/ui/select.component';
import { TextareaComponent } from '../Components/ui/textarea';
import { TimePickerComponent } from '../Components/ui/time-picker';

export type MatrixCellType =
  | 'label'
  | 'serial'
  | 'input'
  | 'textarea'
  | 'select'
  | 'date'
  | 'time'
  | 'checkbox'
  | 'radio';

export interface MatrixHeaderCell {
  label: string;
  colspan?: number;
  rowspan?: number;
  align?: 'left' | 'center' | 'right';
  width?: string;
  className?: string;
}

export interface MatrixColumn {
  key: string;
  label: string;
  type?: MatrixCellType;
  inputType?: 'text' | 'number' | 'email' | 'password';
  align?: 'left' | 'center' | 'right';
  width?: string;
  required?: boolean;
  disabled?: boolean;
  options?: SelectOption[];
  searchable?: boolean;
}

export interface MatrixCell {
  _id?: string;
  key?: string;
  type?: MatrixCellType;
  value?: any;
  label?: string;
  placeholder?: string;
  rows?: number;
  align?: 'left' | 'center' | 'right';
  width?: string;
  colspan?: number;
  rowspan?: number;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  inputType?: 'text' | 'number' | 'email' | 'password';
  options?: SelectOption[];
  searchable?: boolean;
  className?: string;
}

export interface MatrixRow {
  _id?: string;
  cells: MatrixCell[];
  className?: string;
}

@Component({
  selector: 'app-dynamic-matrix-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    InputComponent,
    TextareaComponent,
    CalenderComponent,
    TimePickerComponent,
    SelectComponent,
  ],
  template: `
    <div class="w-full ">
      <table class="min-w-full border border-slate-300 bg-white">
        <thead class="bg-gradient-to-br from-[#1a2746] to-[#121b33] text-white">
          <tr
            *ngFor="let headerRow of topHeaders; trackBy: trackByHeaderRow"
            class="border-b border-white/20"
          >
            <th
              *ngFor="let cell of headerRow; trackBy: trackByHeaderCell"
              [attr.colspan]="cell.colspan || 1"
              [attr.rowspan]="cell.rowspan || 1"
              [style.width]="cell.width || null"
              [ngClass]="cell.className || ''"
              class="border-r border-white/10 px-3 py-2 text-sm font-semibold last:border-r-0"
              [style.text-align]="cell.align || 'center'"
            >
              {{ cell.label }}
            </th>

            <th
              *ngIf="showRowActions && headerRow === topHeaders[topHeaders.length - 1]"
              class="px-3 py-2 text-sm font-semibold text-center"
            >
              Action
            </th>
          </tr>

          <tr *ngIf="columns?.length && !topHeaders?.length" class="border-b border-white/20">
            <th
              *ngFor="let col of columns; trackBy: trackByColumn"
              [style.width]="col.width || null"
              class="border-r border-white/10 px-3 py-2 text-sm font-semibold last:border-r-0"
              [style.text-align]="col.align || 'center'"
            >
              {{ col.label }}
            </th>

            <th *ngIf="showRowActions" class="px-3 py-2 text-sm font-semibold text-center">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            *ngFor="let row of rows; let rowIndex = index; trackBy: trackByRow"
            [ngClass]="row.className || 'hover:bg-slate-50'"
          >
            <td
              *ngFor="let cell of row.cells; let cellIndex = index; trackBy: trackByCell"
              [attr.colspan]="cell.colspan || 1"
              [attr.rowspan]="cell.rowspan || 1"
              [style.width]="cell.width || null"
              [ngClass]="cell.className || ''"
              class="border border-slate-300 px-2 py-2 align-middle"
              [style.text-align]="cell.align || 'left'"
            >
              <ng-container [ngSwitch]="resolveType(cell, cellIndex)">
                <div *ngSwitchCase="'label'" class="text-sm text-slate-700 whitespace-pre-wrap">
                  {{ cell.label ?? cell.value ?? '' }}
                </div>

                <div *ngSwitchCase="'serial'" class="text-center font-semibold text-slate-700">
                  {{ cell.label ?? cell.value ?? rowIndex + 1 }}
                </div>

                <app-input
                  *ngSwitchCase="'input'"
                  [type]="cell.inputType || 'text'"
                  [placeholder]="cell.placeholder || ''"
                  [required]="!!cell.required"
                  [disabled]="!!cell.disabled"
                  [ngModel]="cell.value"
                  (ngModelChange)="updateCell(row._id!, cell._id!, $event)"
                ></app-input>

                <app-textarea
                  *ngSwitchCase="'textarea'"
                  [rows]="cell.rows || 1"
                  [placeholder]="cell.placeholder || ''"
                  [required]="!!cell.required"
                  [disabled]="!!cell.disabled"
                  [ngModel]="cell.value"
                  (ngModelChange)="updateCell(row._id!, cell._id!, $event)"
                ></app-textarea>

                <app-select
                  *ngSwitchCase="'select'"
                  [options]="cell.options || []"
                  [searchable]="cell.searchable ?? true"
                  [required]="!!cell.required"
                  [disabled]="!!cell.disabled"
                  [placeholder]="cell.placeholder || '--Select--'"
                  [ngModel]="cell.value"
                  (ngModelChange)="updateCell(row._id!, cell._id!, $event)"
                ></app-select>

                <app-calendar
                  *ngSwitchCase="'date'"
                  [disabled]="!!cell.disabled"
                  [ngModel]="cell.value"
                  (ngModelChange)="updateCell(row._id!, cell._id!, $event)"
                ></app-calendar>

                <app-time-picker
                  *ngSwitchCase="'time'"
                  [disabled]="!!cell.disabled"
                  [ngModel]="cell.value"
                  (ngModelChange)="updateCell(row._id!, cell._id!, $event)"
                ></app-time-picker>

                <div *ngSwitchCase="'checkbox'" class="flex justify-center">
                  <input
                    type="checkbox"
                    class="h-4 w-4"
                    [disabled]="!!cell.disabled"
                    [checked]="!!cell.value"
                    (change)="updateCell(row._id!, cell._id!, $any($event.target).checked)"
                  />
                </div>

                <div *ngSwitchCase="'radio'" class="flex flex-wrap items-center gap-4">
                  <label
                    *ngFor="let option of cell.options || []"
                    class="flex items-center gap-2 text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      [name]="cell._id"
                      [value]="option.value"
                      [checked]="cell.value === option.value"
                      [disabled]="!!cell.disabled"
                      (change)="updateCell(row._id!, cell._id!, option.value)"
                    />
                    <span>{{ option.label }}</span>
                  </label>
                </div>

                <div *ngSwitchDefault class="text-sm text-slate-700">
                  {{ cell.label ?? cell.value ?? '' }}
                </div>
              </ng-container>
            </td>

            <td *ngIf="showRowActions" class="border border-slate-300 px-2 py-2 text-center align-middle">
              <div class="flex items-center justify-center gap-2">
                <button
                  type="button"
                  class="rounded-md border border-green-600 px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                  (click)="addRow(rowIndex)"
                >
                  Add
                </button>

                <button
                  type="button"
                  class="rounded-md border border-red-600 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  (click)="removeRow(rowIndex)"
                  [disabled]="rows.length <= minRows"
                >
                  Remove
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class DynamicMatrixTableComponent implements OnChanges {
  @Input() topHeaders: MatrixHeaderCell[][] = [];
  @Input() columns: MatrixColumn[] = [];
  @Input() rows: MatrixRow[] = [];
  @Input() showRowActions = false;
  @Input() minRows = 1;

  @Output() rowsChange = new EventEmitter<MatrixRow[]>();
  @Output() dataChange = new EventEmitter<any[]>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows']) {
      this.ensureStableIds();
    }
  }

  private ensureStableIds(): void {
    this.rows = (this.rows || []).map((row, rowIndex) => ({
      ...row,
      _id: row._id || this.makeId('row', rowIndex),
      cells: (row.cells || []).map((cell, cellIndex) => ({
        ...cell,
        _id: cell._id || this.makeId('cell', rowIndex, cellIndex, cell.key || cell.type || 'x'),
      })),
    }));
  }

  private makeId(...parts: any[]): string {
    return parts.join('_');
  }

  trackByHeaderRow = (index: number) => index;

  trackByHeaderCell = (index: number, cell: MatrixHeaderCell) =>
    `${index}_${cell.label}_${cell.colspan ?? 1}_${cell.rowspan ?? 1}`;

  trackByColumn = (index: number, column: MatrixColumn) =>
    column.key || `${index}_${column.label}`;

  trackByRow = (_: number, row: MatrixRow) => row._id || _;

  trackByCell = (_: number, cell: MatrixCell) => cell._id || cell.key || _;

  resolveType(cell: MatrixCell, cellIndex: number): MatrixCellType {
    if (cell.type) return cell.type;
    return this.columns[cellIndex]?.type || 'label';
  }

  updateCell(rowId: string, cellId: string, value: any): void {
    const updatedRows = this.rows.map((row) => {
      if (row._id !== rowId) return row;

      return {
        ...row,
        cells: row.cells.map((cell) =>
          cell._id === cellId ? { ...cell, value } : cell
        ),
      };
    });

    this.rows = updatedRows;
    this.rowsChange.emit(this.rows);
    this.dataChange.emit(this.toFlatData());
  }

  addRow(afterIndex: number): void {
    const baseRow = this.rows[afterIndex];
    if (!baseRow) return;

    const newRow: MatrixRow = {
      _id: this.makeId('row', Date.now(), Math.random().toString(36).slice(2, 7)),
      cells: baseRow.cells.map((cell, cellIndex) => ({
        ...cell,
        _id: this.makeId('cell', Date.now(), cellIndex, Math.random().toString(36).slice(2, 7)),
        value: cell.type === 'serial' ? '' : this.getEmptyValue(cell),
      })),
    };

    this.rows = [
      ...this.rows.slice(0, afterIndex + 1),
      newRow,
      ...this.rows.slice(afterIndex + 1),
    ];

    this.recalculateSerials();
    this.rowsChange.emit(this.rows);
    this.dataChange.emit(this.toFlatData());
  }

  removeRow(rowIndex: number): void {
    if (this.rows.length <= this.minRows) return;

    this.rows = this.rows.filter((_, index) => index !== rowIndex);
    this.recalculateSerials();
    this.rowsChange.emit(this.rows);
    this.dataChange.emit(this.toFlatData());
  }

  private recalculateSerials(): void {
    this.rows = this.rows.map((row, index) => ({
      ...row,
      cells: row.cells.map((cell) =>
        cell.type === 'serial' ? { ...cell, value: String(index + 1) } : cell
      ),
    }));
  }

  private getEmptyValue(cell: MatrixCell): any {
    if (cell.type === 'checkbox') return false;
    return '';
  }

  toFlatData(): any[] {
    return this.rows.map((row) => {
      const obj: any = {};
      row.cells.forEach((cell, index) => {
        const key = cell.key || this.columns[index]?.key;
        if (key) obj[key] = cell.value;
      });
      return obj;
    });
  }


  
}