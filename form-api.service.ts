import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class FormApiService {
  currentFormId: string | null = null;
  currentFormName: any = null;
  constructor(private api:ApiService) {}

  saveDraft(payload: any, id?: string): Observable<any> {
    if (id) {
      return this.api.patch(`/api/forms/${this.currentFormName}/${this.currentFormId}`, payload);
    }
    return this.api.post(`/api/forms/${this.currentFormName}/ `, payload);
  }

  submitForm(payload: any): Observable<any> {
    return this.api.put(`/api/forms/${this.currentFormName}/${this.currentFormId}/submit`, payload);
  }

  getForm(id: string): Observable<any> {
    return this.api.get(`/api/forms/${this.currentFormName}/${this.currentFormId}`);
  }

  setCurrentForm(id: string, name: any) {
    this.currentFormId = id;
    this.currentFormName = name;
  }
}