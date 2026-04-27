import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { Apiendpoints } from '../ApiEndPoints';

@Injectable({ providedIn: 'root' })
export class DynamicFormSchemaService {
  constructor(private apiService: ApiService) {}

  private endpointMap: Record<
    string,
    { endpoint: string; labelKey: string; valueKey: string; htmlTag?: string }
  > = {
    ships: { endpoint: Apiendpoints.MASTER_SHIP, labelKey: 'name', valueKey: 'id' },
    ship_id: { endpoint: Apiendpoints.MASTER_SHIP, labelKey: 'ship_name', valueKey: 'ship_id' },
    ship_name: { endpoint: Apiendpoints.MASTER_SHIP, labelKey: 'name', valueKey: 'id' },
    systems: { endpoint: Apiendpoints.MASTER_SYSTEM, labelKey: 'system_name', valueKey: 'system_id' },
    system_id: { endpoint: Apiendpoints.MASTER_SYSTEM, labelKey: 'system_name', valueKey: 'system_id' },
    system_name: { endpoint: Apiendpoints.MASTER_SYSTEM, labelKey: 'system_name', valueKey: 'system_name' },
    units: { endpoint: Apiendpoints.MASTER_UNIT, labelKey: 'unit_name', valueKey: 'unit_id' },
    unit_id: { endpoint: Apiendpoints.MASTER_UNIT, labelKey: 'unit_name', valueKey: 'unit_id' },
    unit_name: { endpoint: Apiendpoints.MASTER_UNIT, labelKey: 'unit_name', valueKey: 'unit_name' },
    subsystems: { endpoint: Apiendpoints.MASTER_SUB_MODULE, labelKey: 'sub_module_name', valueKey: 'sub_module_id' },
  };

  async enrichSchema(schema: any, context: any = {}): Promise<any> {
    let updated = structuredClone(schema);
    updated = this.applyPrefill(updated, context);
    updated = await this.applyLookups(updated, context);
    return updated;
  }

  applyPrefill(schema: any, context: any): any {
    const apply = (node: any) => {
      if (!node) return;

      if (node.prefill && node.prefillSource) {
        const key = String(node.prefillSource).replace('context.', '');
        if (context[key] !== undefined) {
          node.value = context[key];
          if (node.lockAfterPrefill) {
            node.disabled = true;
          }
        }
      }

      if (node.hiddenKey && context[node.hiddenKey] !== undefined) {
        node.hiddenValue = context[node.hiddenKey];
      }
    };

    schema.sections?.forEach((section: any) => {
      section.fields?.forEach(apply);
      section.tables?.forEach((table: any) => {
        table.rows?.forEach((row: any) => {
          row.cells?.forEach(apply);
        });
      });
    });

    return schema;
  }

  async applyLookups(schema: any, context: any = {}): Promise<any> {
    const cache = new Map<string, any[]>();

    const load = async (node: any) => {
      if (!node?.isDynamic || !node.lookupKey) return;

      const endpoint = this.endpointMap[String(node.lookupKey)];
      if (!endpoint) {
        node.options = [];
        return;
      }

      if (!cache.has(node.lookupKey)) {
        try {
            console.log('ENDPOINT', endpoint, node.lookupKey);
          const res = await firstValueFrom(
            this.apiService.getDropdownData(endpoint.endpoint, {
              labelKey: endpoint.labelKey as any,
              valueKey: endpoint.valueKey as any,
            }),
          );
          cache.set(node.lookupKey, res);
          console.log('RES', res);
          console.log('NODE', node);
        } catch (error) {
          console.warn(`Lookup failed for ${node.lookupKey}`, error);
          cache.set(node.lookupKey, []);
        }
      }

      node.options = cache.get(node.lookupKey) || [];
    };

    for (const section of schema.sections || []) {
      for (const field of section.fields || []) {
        await load(field);
      }

      for (const table of section.tables || []) {
        for (const row of table.rows || []) {
          for (const cell of row.cells || []) {
            await load(cell);
          }
        }
      }
    }

    return schema;
  }

  patchSchema(schema: any, data: any = {}): any {
    const patchedSchema = structuredClone(schema);

    for (const section of patchedSchema.sections || []) {
      for (const field of section.fields || []) {
        if (data[field.name] !== undefined) {
          field.value = data[field.name];
        }
        if (field.hiddenKey && data[field.hiddenKey] !== undefined) {
          field.hiddenValue = data[field.hiddenKey];
        }
      }

      for (const table of section.tables || []) {
        const tableData = data[table.id];
        if (!Array.isArray(tableData)) continue;

        table.rows?.forEach((row: any, rowIndex: number) => {
          const rowData = tableData[rowIndex];
          if (!rowData) return;

          row.cells?.forEach((cell: any) => {
            if (cell.key && rowData[cell.key] !== undefined) {
              cell.value = rowData[cell.key];
            }
            if (cell.hiddenKey && rowData[cell.hiddenKey] !== undefined) {
              cell.hiddenValue = rowData[cell.hiddenKey];
            }
          });
        });
      }
    }

    return patchedSchema;
  }

//   private normalizeDropdownResponse(response: any): any[] {
//     if (Array.isArray(response)) return response;
//     if (Array.isArray(response?.data)) return response.data;
//     if (Array.isArray(response?.result)) return response.result;
//     return [];
//   }
}
