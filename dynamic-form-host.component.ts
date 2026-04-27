import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  DynamicFormRendererComponent,
  DynamicFormSchema,
} from './dynamic-form-renderer.component';
import { DynamicFormSchemaService } from './dynamic-form-schema.service';
import { FormApiService } from './form-api.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-dynamic-form-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DynamicFormRendererComponent],
  template: `
    <div class="mx-auto max-w-8xl " *ngIf="schema">
      <app-dynamic-form-renderer
        [schema]="schema"
        [autosave]="false"
        (schemaChange)="schema = $event"
        (formValueChange)="onChange($event)"
        (draftSave)="onDraft($event)"
        (formSubmit)="onSubmit($event)"
      ></app-dynamic-form-renderer>

      
    </div>
  `,
})
export class DynamicFormHostComponent implements OnInit {
  schema!: DynamicFormSchema;
  payload: any = {};

  constructor(
    private service: DynamicFormSchemaService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private fronAPI: FormApiService,
  ) {}

  private async loadSchemaFromAssets(schemaFileName: string): Promise<DynamicFormSchema> {
    const response = await fetch(`/assets/json/${schemaFileName}`);
    if (!response.ok) {
      throw new Error(`Failed to load schema: ${schemaFileName} (${response.status})`);
    }
    return (await response.json()) as DynamicFormSchema;
  }

  async ngOnInit(): Promise<void> {
    const context = {
      id: 1,
      name: 'INS Vikrant',
      system_id: 5,
      system_name: 'RAWL',
      unit_id: 3,
      unit_name: 'WRSTG',
    };

    // Runtime dynamic schema load from assets (no import-assert needed).
    let baseSchema: DynamicFormSchema;
    try {
      const formName = this.route.snapshot.params['formName'];
      const getId = this.route.snapshot.params['getId'];
      console.log('formName', formName);
      console.log('getId', getId);
      this.fronAPI.setCurrentForm(getId, formName);
      const schemaFileName = `${formName}.json`;
      baseSchema = structuredClone(await this.loadSchemaFromAssets(schemaFileName));
    } catch (error) {
      console.error('Failed to load schema JSON dynamically.', error);
      return;
    }

    // Example edit mode patch. Replace with real API data when needed.
    const patchedSchema = this.service.patchSchema(baseSchema, data);

    try {
      this.schema = await this.service.enrichSchema(patchedSchema, context);
      this.cdr.markForCheck();
      //   console.log('SCHEMA', this.schema);
    } catch (error) {
      // Keep UI usable even when lookup APIs are unavailable.
      this.schema = patchedSchema;
      this.cdr.markForCheck();
      console.warn('Schema enrichment failed, rendering base schema.', error);
    }
  }

  onChange(data: any) {
    this.payload = data;
  }

  onDraft(data: any) {
    this.payload = data;
    console.log('SAVE DRAFT API CALL', data);
    // this.api.saveDraft(data).subscribe();
  }

  onSubmit(data: any) {
    this.payload = data;
    console.log('SUBMIT API CALL', data);
    // this.api.submitForm(data, 'id').subscribe();
  }


}


const data = {
}
   
