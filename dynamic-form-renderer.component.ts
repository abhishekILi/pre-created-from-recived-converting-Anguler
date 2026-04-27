import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  DynamicSectionRendererComponent,
  DynamicSectionSchema,
} from './dynamic-section-renderer.component';
import { FormApiService } from './form-api.service';
import { ApprovalWorkFlow } from '../Components/approval-work-flow/approval-work-flow';

export interface DynamicFormSchema {
  formId: string;
  title: string;
  sourceFile?: string;
  sections: DynamicSectionSchema[];
}

@Component({
  selector: 'app-dynamic-form-renderer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DynamicSectionRendererComponent, ApprovalWorkFlow ],
  template: `

<div class="flex flex-col bg-slate-100 h-screen">
  <div class="flex-1 ">
    <div class="sticky top-0 z-30 flex items-center justify-between border-b border-slate-300 bg-blue-950 px-4 py-2">
      
      <button type="button" 
        class="inline-flex items-center rounded-full bg-blue-600 px-3 py-1.5 text-[10px] font-bold uppercase text-white shadow-sm transition hover:bg-blue-700">
        <i class="fa fa-clock-rotate-left mr-1.5"></i>
        {{ schema?.title }}
      </button>

      <div class="flex p-0.5 bg-white rounded-full border border-slate-200 shadow-sm">
        <button 
          *ngFor="let tab of eqpList"
          (click)="setActiveTab(tab)"
          [ngClass]="activeTab.id === tab.id 
            ? 'bg-yellow-500 text-gray-700 border-[1.5px] border-gray-300 text-blue-600 shadow-sm' 
            : 'text-gray-500 border-[1.5px] border-transparent hover:text-gray-700'"
          class="flex items-center gap-1.5 px-4 py-1 rounded-full text-[11px] font-bold transition-all">
          <i [class]="tab.icon" class="text-[12px]"></i>
          {{ tab.label }}
        </button>
      </div>

      <button type="button" (click)="shouldShowUserPopup=true"
        class="inline-flex items-center rounded-full bg-green-600 px-3 py-1.5 text-[10px] font-bold uppercase text-white shadow-sm transition hover:bg-green-700">
        <i class="fa fa-bolt mr-1.5"></i>
        Action
      </button>
    </div>

    <app-dynamic-section-renderer
      *ngIf="currentSection"
      
      [section]="currentSection"
      [isLastSection]="currentSectionIndex === totalSections - 1"
      (sectionChange)="onSectionChange(currentSectionIndex, $event)"
      (tableDataChange)="onTableDataChange($event)"
    ></app-dynamic-section-renderer>
  </div>

  <div class="sticky bottom-0 w-full bg-slate-200 border-t border-slate-200 shadow-md px-4 py-2 z-30">
    <div class="flex flex-wrap items-center justify-between max-w-7xl mx-auto gap-4">
      
      <div class="w-24">
        <button type="button" (click)="prevSection()" [disabled]="currentSectionIndex === 0"
          class="w-full rounded-full border border-slate-300 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          ← Prev
        </button>
      </div>

      <div class="flex flex items-center gap-1">
        <div class="flex items-center gap-1">
          <button (click)="goToSection(0)" class="p-1 text-slate-400 hover:text-black">«</button>
          
          <div class="flex gap-1">
            <button *ngFor="let pageIndex of visiblePageIndexes" 
              (click)="goToSection(pageIndex)"
              [ngClass]="pageIndex === currentSectionIndex ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border-slate-200'"
              class="w-7 h-7 flex items-center justify-center rounded-full border text-[10px] font-bold transition-all">
              {{ pageIndex + 1 }}
            </button>
          </div>

          <button (click)="goToSection(totalSections - 1)" class="p-1 text-slate-400 hover:text-black">»</button>
        </div>

        <div class="flex items-center gap-2.5">
          <span class="text-[10px] text-slate-500 uppercase font-bold">Go to:</span>
          <input type="number" [(ngModel)]="pageJumpValue" (keyup.enter)="goToPageInput()"
            class="w-16 rounded border border-slate-300 py-0.5 text-gray-700 text-center text-[10px] focus:ring-1 focus:ring-blue-500 outline-none" />
          <button (click)="goToPageInput()" class="text-[10px] font-bold text-blue-600 hover:underline">GO</button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button (click)="saveDraft()" 
          class="rounded-full border border-blue-600 px-4 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-50">
          SAVE DRAFT
        </button>
        
        <button *ngIf="!isLastSection" (click)="nextSection()" 
          class="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800">
          NEXT →
        </button>

        <button *ngIf="isLastSection" (click)="submitForm()" 
          class="rounded-full bg-green-600 px-4 py-1.5 text-[11px] font-bold text-white hover:bg-green-700">
          SUBMIT
        </button>
      </div>

    </div>
  </div>
</div>

<app-approval-work-flow [showUserPopuphead]="shouldShowUserPopup" (showUserPopupChange)="shouldShowUserPopup = $event"></app-approval-work-flow>
    `
  ,
})
export class DynamicFormRendererComponent {
  @Input() schema!: DynamicFormSchema;
  @Input() autosave = false;
  @Input() eqpList: any[] = [
    { id: 'EQP001', label: 'Equipment 1', icon: 'fa-solid fa-computer' },
    { id: 'EQP002', label: 'Equipment 2', icon: 'fa-solid fa-desktop' },
    { id: 'EQP003', label: 'Equipment 3', icon: 'fa-solid fa-laptop' },
  ];
  activeTab = this.eqpList[0];
   @Output() schemaChange = new EventEmitter<DynamicFormSchema>();
  @Output() formValueChange = new EventEmitter<any>();
  @Output() draftSave = new EventEmitter<any>();
  @Output() formSubmit = new EventEmitter<any>();

  shouldShowUserPopup = false;
  currentSectionIndex = 0;
  pageWindowSize = 5;
  pageWindowStart = 0;
  pageJumpValue: number | null = null;
  formId: string | null = null;

  constructor(private api: FormApiService) {}

  get currentSection(): DynamicSectionSchema | null {
    return this.schema?.sections?.[this.currentSectionIndex] || null;
  }

  get totalSections(): number {
    return this.schema?.sections?.length || 0;
  }

  get isLastSection(): boolean {
    return this.currentSectionIndex === this.totalSections - 1;
  }

  get visiblePageIndexes(): number[] {
    const end = Math.min(this.pageWindowStart + this.pageWindowSize, this.totalSections);
    return Array.from({ length: end - this.pageWindowStart }, (_, i) => this.pageWindowStart + i);
  }

  goToSection(index: number): void {
    if (index < 0 || index >= this.totalSections) return;
    this.currentSectionIndex = index;
    this.ensureCurrentPageVisible();
  }

  prevSection(): void {
    if (this.currentSectionIndex > 0) {
      this.currentSectionIndex--;
      this.ensureCurrentPageVisible();
    }
  }

  nextSection(): void {
    if (this.currentSectionIndex < this.totalSections - 1) {
      this.currentSectionIndex++;
      this.ensureCurrentPageVisible();
    }
  }

  shiftWindowLeft(): void {
    this.pageWindowStart = Math.max(0, this.pageWindowStart - this.pageWindowSize);
  }

  shiftWindowRight(): void {
    const maxStart = Math.max(0, this.totalSections - this.pageWindowSize);
    this.pageWindowStart = Math.min(maxStart, this.pageWindowStart + this.pageWindowSize);
  }

  goToPageInput(): void {
    if (this.pageJumpValue == null) return;

    const pageIndex = Number(this.pageJumpValue) - 1;
    if (Number.isNaN(pageIndex)) return;

    if (pageIndex >= 0 && pageIndex < this.totalSections) {
      this.currentSectionIndex = pageIndex;
      this.ensureCurrentPageVisible();
    }

    this.pageJumpValue = null;
  }

  ensureCurrentPageVisible(): void {
    if (this.currentSectionIndex < this.pageWindowStart) {
      this.pageWindowStart = this.currentSectionIndex;
      return;
    }

    if (this.currentSectionIndex >= this.pageWindowStart + this.pageWindowSize) {
      this.pageWindowStart = this.currentSectionIndex - this.pageWindowSize + 1;
    }
  }

  onSectionChange(index: number, updatedSection: DynamicSectionSchema): void {
    const updatedSections = [...this.schema.sections];
    updatedSections[index] = updatedSection;

    this.schema = {
      ...this.schema,
      sections: updatedSections,
    };

    this.schemaChange.emit(this.schema);

    const payload = this.buildFlatPayload();
    this.formValueChange.emit(payload);

    if (this.autosave) {
      this.api.saveDraft(payload, this.formId || undefined).subscribe({
        next: (res: any) => {
          if (!this.formId && res?.id) this.formId = res.id;
        },
        error: () => {},
      });
    }
  }

  onTableDataChange(_: { tableId: string; data: any[] }): void {
    this.formValueChange.emit(this.buildFlatPayload());
  }

  saveDraft(): void {
    const payload = this.buildFlatPayload();

    this.api.saveDraft(payload, this.formId || undefined).subscribe({
      next: (res: any) => {
        if (!this.formId && res?.id) this.formId = res.id;
        this.draftSave.emit(payload);
      },
      error: () => this.draftSave.emit(payload),
    });
  }

  submitForm(): void {
    const payload = this.buildFlatPayload();

    if (!this.formId) {
      this.api.saveDraft(payload).subscribe({
        next: (res: any) => {
          if (res?.id) {
            this.formId = res.id;
            this.api.submitForm(payload).subscribe({
              next: () => this.formSubmit.emit(payload),
              error: () => this.formSubmit.emit(payload),
            });
          }
        },
        error: () => this.formSubmit.emit(payload),
      });
      return;
    }

    this.api.submitForm(payload).subscribe({
      next: () => this.formSubmit.emit(payload),
      error: () => this.formSubmit.emit(payload),
    });
  }

  buildFlatPayload(): any {
    const payload: any = {};

    for (const section of this.schema.sections || []) {
      for (const field of section.fields || []) {
        payload[field.name] = field.value ?? null;
        if (field.hiddenKey && field.hiddenValue !== undefined) {
          payload[field.hiddenKey] = field.hiddenValue ?? null;
        }
      }

      for (const table of section.tables || []) {
        payload[table.id] = (table.rows || []).map((row: any) => {
          const rowObj: any = {};
          for (const cell of row.cells || []) {
            if (cell.key) rowObj[cell.key] = cell.value ?? null;
            if (cell.hiddenKey && cell.hiddenValue !== undefined) {
              rowObj[cell.hiddenKey] = cell.hiddenValue ?? null;
            }
          }
          return rowObj;
        });
      }
    }

    return payload;
  }

  setActiveTab(tab: any): void {
    this.activeTab = tab;
  }
}

