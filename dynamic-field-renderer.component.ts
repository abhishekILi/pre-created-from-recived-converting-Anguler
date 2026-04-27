import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '../Components/ui/input.component';
import { CalenderComponent } from '../Components/ui/calender.component';
import { SelectOption, SelectComponent } from '../Components/ui/select.component';
import { TextareaComponent } from '../Components/ui/textarea';
import { TimePickerComponent } from '../Components/ui/time-picker';
import { FileUploadComponent } from '../Components/ui/file-upload/file-upload.component';

export interface DynamicFieldSchema {
  type: 'input' | 'textarea' | 'select' | 'date' | 'time' | 'checkbox' | 'radio' | 'file';
  name: string;
  label?: string;
  value?: any;
  hiddenKey?: string;
  hiddenValue?: any;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  inputType?: 'text' | 'number' | 'email' | 'password';
  options?: SelectOption[];
}

@Component({
  selector: 'app-dynamic-field-renderer',
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
    FileUploadComponent,
  ],
  template: `
    <ng-container [ngSwitch]="field?.type">
      <app-input
        *ngSwitchCase="'input'"
        [label]="field.label || ''"
        [type]="field.inputType || 'text'"
        [placeholder]="field.placeholder || ''"
        [required]="!!field.required"
        [disabled]="!!field.disabled"
        [ngModel]="field.value"
        (ngModelChange)="onValueChange($event)"
      ></app-input>

      <app-textarea
        *ngSwitchCase="'textarea'"
        [label]="field.label || ''"
        [rows]="field.rows || 1"
        [placeholder]="field.placeholder || ''"
        [required]="!!field.required"
        [disabled]="!!field.disabled"
        [ngModel]="field.value"
        (ngModelChange)="onValueChange($event)"
      ></app-textarea>

      <app-select
        *ngSwitchCase="'select'"
        [label]="field.label || ''"
        [options]="field.options || []"
        [placeholder]="field.placeholder || '--Select--'"
        [required]="!!field.required"
        [disabled]="!!field.disabled"
        [ngModel]="field.value"
        (ngModelChange)="onValueChange($event)"
      ></app-select>

      <app-calendar
        *ngSwitchCase="'date'"
        [label]="field.label || ''"
        [disabled]="!!field.disabled"
        [ngModel]="field.value"
        (ngModelChange)="onValueChange($event)"
      ></app-calendar>

      <app-time-picker
        *ngSwitchCase="'time'"
        [label]="field.label || ''"
        [disabled]="!!field.disabled"
        [ngModel]="field.value"
        (ngModelChange)="onValueChange($event)"
      ></app-time-picker>

      <app-file-upload
        *ngSwitchCase="'file'"
        [label]="field.label || ''"
        [disabled]="!!field.disabled"
        [multiple]="true"
        [ngModel]="field.value"
        (ngModelChange)="onValueChange($event)"
      ></app-file-upload>
      <div *ngSwitchCase="'checkbox'" class="flex flex-col gap-2">
        <label class="text-[11px] font-semibold uppercase tracking-[1.4px] text-slate-600">
          {{ field.label }}
        </label>
        <input
          type="checkbox"
          class="h-4 w-4"
          [checked]="!!field.value"
          [disabled]="!!field.disabled"
          (change)="onValueChange(($any($event.target)).checked)"
        />
      </div>

      <div *ngSwitchCase="'radio'" class="flex flex-col gap-2">
        <label class="text-[11px] font-semibold uppercase tracking-[1.4px] text-slate-600">
          {{ field.label }}
        </label>

        <div class="flex flex-wrap items-center gap-5">
          <label
            *ngFor="let option of field.options || []"
            class="flex items-center gap-2"
          >
            <input
              type="radio"
              [name]="field.name"
              [value]="option.value"
              [checked]="field.value === option.value"
              [disabled]="!!field.disabled"
              (change)="onValueChange(option.value)"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </div>
    </ng-container>
  `,
})
export class DynamicFieldRendererComponent {
  @Input() field!: DynamicFieldSchema;
  @Output() fieldChange = new EventEmitter<DynamicFieldSchema>();

  onValueChange(value: any) {
    this.field = {
      ...this.field,
      value,
    };
    this.fieldChange.emit(this.field);
  }
}