const fs = require('fs-extra');
const path = require('path');
const cheerio = require('cheerio');
const glob = require('glob');

const MAX_FIELDS_PER_SECTION = 30;
const MAX_SINGLE_TABLE_ROWS = 40;
const MAX_TOTAL_TABLE_ROWS = 45;
const MAX_TABLES_PER_SECTION = 3;

/**
 * true => dynamic select ko readonly/prefilled text input bana dega
 * false => dynamic select ko select hi rakhega with isDynamic=true
 */
const CONVERT_DYNAMIC_SELECT_TO_INPUT = false;

function cleanDjangoTemplate(html) {
  return html
    .replace(/\{%\s*extends[\s\S]*?%\}/g, '')
    .replace(/\{%\s*load[\s\S]*?%\}/g, '')
    .replace(/\{%\s*block[\s\S]*?%\}/g, '')
    .replace(/\{%\s*endblock[\s\S]*?%\}/g, '')
    .replace(/\{%\s*csrf_token\s*%\}/g, '')
    .replace(/\{%\s*url[\s\S]*?%\}/g, '')
    .replace(/\{\{[\s\S]*?\}\}/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function normalizeText(text) {
  return (text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeaderLabel(text) {
  if (!text) return '';
  
  let result = normalizeText(text);
  
  // ONLY apply specific replacements, NO auto-space insertion
  result = result
    .replace(/SerNo\./gi, 'Ser No.')
    .replace(/Descriptiona\./gi, 'Description')
    .replace(/Remarksd\./gi, 'Remarks')
    .replace(/Obtained\(/gi, 'Obtained (')
    .replace(/Values\(/gi, 'Values (')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    // Only clean multiple spaces (don't add new ones)
    .replace(/\s+/g, ' ')
    .trim();
  
  return result;
}

function slugify(value) {
  return (
    normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'section'
  );
}

function makeId(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).replace(/[^a-zA-Z0-9_]+/g, '_'))
    .join('_');
}

function hasTemplateSyntax(text) {
  return /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/.test(text || '');
}

function getTitle($) {
  return (
    normalizeText($('.caption-subject.bold').first().text()) ||
    normalizeText($('title').first().text()) ||
    'Legacy Form'
  );
}

function detectFieldType($el) {
  const tag = ($el[0]?.tagName || '').toLowerCase();

  if (tag === 'textarea') return 'textarea';
  if (tag === 'select') return 'select';

  if (tag === 'input') {
    const type = ($el.attr('type') || 'text').toLowerCase();
    if (type === 'date') return 'date';
    if (type === 'time') return 'time';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    return 'input';
  }

  return 'label';
}

function getInputType($el) {
  const tag = ($el[0]?.tagName || '').toLowerCase();
  if (tag !== 'input') return undefined;

  const type = ($el.attr('type') || 'text').toLowerCase();
  if (['text', 'number', 'email', 'password'].includes(type)) return type;
  return 'text';
}

function extractOptions($, $select) {
  const options = [];
  let isDynamic = false;

  $select.find('option').each((_, opt) => {
    const $opt = $(opt);
    const label = normalizeText($opt.text());
    const value = $opt.attr('value') ?? '';

    if (hasTemplateSyntax(label) || hasTemplateSyntax(value)) {
      isDynamic = true;
      return;
    }

    if (!label && !value) return;

    options.push({ label, value });
  });

  // agar sirf placeholder ho aur baaki meaningful options na ho to bhi dynamic assume kar sakte ho
  const nonPlaceholder = options.filter(
    (o) =>
      normalizeText(o.label).toLowerCase() !== '--select--' &&
      normalizeText(o.label).toLowerCase() !== '-- select --' &&
      normalizeText(o.label).toLowerCase() !== '--sub_system_name--' &&
      normalizeText(o.label).toLowerCase() !== '--select media--' &&
      normalizeText(o.label).toLowerCase() !== '--select media type--'
  );

  if (options.length && nonPlaceholder.length === 0) {
    isDynamic = true;
  }

  return {
    options: isDynamic ? [] : options,
    isDynamic,
  };
}

function extractRadioOptions($, $el) {
  const name = $el.attr('name');
  if (!name) return [];

  const options = [];
  $(`input[type="radio"][name="${name}"]`).each((_, radio) => {
    const $radio = $(radio);
    const value = $radio.attr('value') ?? '';
    const label =
      normalizeText($radio.closest('label').text()) ||
      normalizeText($radio.parent().text()) ||
      value;

    if (!options.some((o) => o.value === value)) {
      options.push({ label, value });
    }
  });

  return options;
}

function inferLabel($, $el, fallbackName) {
  return (
    normalizeText($el.closest('div').find('label').first().text()) ||
    normalizeText($el.prev('label').text()) ||
    normalizeText(
      $el
        .closest('p')
        .clone()
        .children('input,textarea,select,strong,small,span')
        .remove()
        .end()
        .text()
    ) ||
    fallbackName
  );
}

function convertDynamicSelectField(field) {
  if (!field.isDynamic) return field;

  if (CONVERT_DYNAMIC_SELECT_TO_INPUT) {
    return {
      ...field,
      type: 'input',
      inputType: 'text',
      options: [],
      prefill: true,
      prefillSource: `context.${field.name}`,
      lockAfterPrefill: true,
      hiddenKey: field.name.endsWith('_id') ? field.name : `${field.name}_id`,
      displayKey: field.name,
    };
  }

  return {
    ...field,
    lookupKey: field.lookupKey || field.name,
    prefill: true,
    prefillSource: `context.${field.name}`,
  };
}

function extractField($, el, index = 0) {
  const $el = $(el);
  const type = detectFieldType($el);
  const name = $el.attr('name') || $el.attr('id') || `field_${index + 1}`;

  let field = {
    type,
    name,
    label: inferLabel($, $el, name),
    required: $el.is('[required]'),
    disabled: $el.is('[disabled]'),
    placeholder: $el.attr('placeholder') || '',
    value: '',
  };

  if (type === 'input') {
    field.inputType = getInputType($el);
  }

  if (type === 'textarea') {
    field.rows = Number($el.attr('rows') || 1);
  }

  if (type === 'select') {
    const selectMeta = extractOptions($, $el);
    field.options = selectMeta.options;
    field.isDynamic = selectMeta.isDynamic;

    if (field.isDynamic) {
      field.lookupKey = field.name;
      field = convertDynamicSelectField(field);
    }
  }

  if (type === 'radio') {
    field.options = extractRadioOptions($, $el);
  }

  return field;
}

function extractStandaloneFields($, $section) {
  const results = [];
  const seen = new Set();

  $section.children().each((blockIndex, node) => {
    const $node = $(node);
    if ($node.is('table') || $node.find('table').length) return;

    $node.find('input, textarea, select').each((i, el) => {
      const $el = $(el);
      const type = detectFieldType($el);
      const name = $el.attr('name') || $el.attr('id') || `field_${blockIndex}_${i}`;

      const uniqueKey = type === 'radio' ? `radio_${name}` : name;
      if (seen.has(uniqueKey)) return;

      seen.add(uniqueKey);
      results.push(extractField($, el, i));
    });
  });

  return results;
}

function isMatrixTable($, $table) {
  const rowCount = $table.find('tbody tr').length;
  const headerRows = $table.find('thead tr').length;
  let hasMerged = false;

  $table.find('th, td').each((_, cell) => {
    const colspan = Number($(cell).attr('colspan') || 1);
    const rowspan = Number($(cell).attr('rowspan') || 1);
    if (colspan > 1 || rowspan > 1) hasMerged = true;
  });

  return hasMerged || headerRows > 1 || rowCount > 8;
}

function extractHeaderRows($, $table) {
  const headerRows = [];

  $table.find('thead tr').each((_, tr) => {
    const cells = [];
    $(tr)
      .find('th, td')
      .each((__, cell) => {
        const $cell = $(cell);
        cells.push({
          label: cleanHeaderLabel($cell.text()),
          colspan: Number($cell.attr('colspan') || 1),
          rowspan: Number($cell.attr('rowspan') || 1),
          align: 'center',
        });
      });

    if (cells.length) headerRows.push(cells);
  });

  return headerRows;
}

function detectRowActions($, $table) {
  let foundAction = false;

  $table.find('thead th, thead td').each((_, cell) => {
    const text = normalizeText($(cell).text()).toLowerCase();
    if (text.includes('action')) {
      foundAction = true;
    }
  });

  $table.find('button, a, input[type="button"], input[type="submit"]').each((_, el) => {
    const $el = $(el);
    const text = normalizeText($el.text() || $el.val() || '');
    if (text === '+' || text === '-' || /add|remove/i.test(text)) {
      foundAction = true;
    }
  });

  return foundAction;
}

function mapEditableCell(field, colspan = 1, rowspan = 1, rowId = '', cellIndex = 0) {
  return {
    _id: makeId(rowId, 'cell', cellIndex + 1, field.name || field.type || 'x'),
    key: field.name,
    type:
      field.type === 'input' ? 'input' :
      field.type === 'textarea' ? 'textarea' :
      field.type === 'select' ? 'select' :
      field.type === 'date' ? 'date' :
      field.type === 'time' ? 'time' :
      field.type === 'checkbox' ? 'checkbox' :
      field.type === 'radio' ? 'radio' :
      'input',
    value: '',
    rows: field.rows,
    required: field.required,
    disabled: field.disabled,
    placeholder: field.placeholder,
    inputType: field.inputType,
    options: field.options,
    colspan,
    rowspan,
    align: 'left',
    isDynamic: field.isDynamic,
    lookupKey: field.lookupKey,
    prefill: field.prefill,
    prefillSource: field.prefillSource,
    lockAfterPrefill: field.lockAfterPrefill,
    hiddenKey: field.hiddenKey,
    displayKey: field.displayKey,
  };
}

function buildStaticCell(cellIndex, value, colspan, rowspan, rowId, align = 'left') {
  return {
    _id: makeId(rowId, 'cell', cellIndex + 1, 'static'),
    type: cellIndex === 0 ? 'serial' : 'label',
    value,
    colspan,
    rowspan,
    align,
  };
}

function extractSimpleTable($, $table, sectionTitle, tableIndex) {
  const columns = [];
  const rows = [];
  const baseId = `${slugify(sectionTitle)}_table_${tableIndex + 1}`;

  const firstHeaderRow = $table.find('thead tr').first();
  firstHeaderRow.find('th, td').each((i, cell) => {
    columns.push({
      key: `col_${i + 1}`,
      label: cleanHeaderLabel($(cell).text()) || `Column ${i + 1}`,
      type: 'label',
      align: i === 0 ? 'center' : 'left',
    });
  });

  $table.find('tbody tr').each((rowIndex, tr) => {
    const rowId = makeId(baseId, 'row', rowIndex + 1);
    const row = { _id: rowId, cells: [] };

    $(tr).find('th, td').each((cellIndex, cell) => {
      const $cell = $(cell);
      const colspan = Number($cell.attr('colspan') || 1);
      const rowspan = Number($cell.attr('rowspan') || 1);

      const inputs = $cell.find('input, textarea, select');

      if (inputs.length > 1) {
        const firstInput = inputs.first();
        const field = extractField($, firstInput, cellIndex);
        row.cells.push(mapEditableCell(field, colspan, rowspan, rowId, cellIndex));
        return;
      }

      const input = inputs.first();
      if (input.length) {
        const field = extractField($, input, cellIndex);
        row.cells.push(mapEditableCell(field, colspan, rowspan, rowId, cellIndex));
      } else {
        row.cells.push(
          buildStaticCell(
            cellIndex,
            normalizeText($cell.text()),
            colspan,
            rowspan,
            rowId,
            cellIndex === 0 ? 'center' : 'left'
          )
        );
      }
    });

    if (row.cells.length) rows.push(row);
  });

  return {
    id: baseId,
    sectionType: 'simpleTable',
    title: sectionTitle,
    topHeaders: [],
    columns,
    rows,
    showRowActions: detectRowActions($, $table),
    minRows: 1,
  };
}

function extractMatrixTable($, $table, sectionTitle, tableIndex) {
  const topHeaders = extractHeaderRows($, $table);
  const rows = [];
  const columns = [];
  const baseId = `${slugify(sectionTitle)}_matrix_${tableIndex + 1}`;

  const tbodyRows = $table.find('tbody tr');
  const remainingRowCount = tbodyRows.length;

  tbodyRows.each((rowIndex, tr) => {
    const rowId = makeId(baseId, 'row', rowIndex + 1);
    const row = { _id: rowId, cells: [] };

    $(tr).find('th, td').each((cellIndex, cell) => {
      const $cell = $(cell);
      const colspan = Number($cell.attr('colspan') || 1);
      const originalRowspan = Number($cell.attr('rowspan') || 1);
      const safeRowspan = Math.min(
        originalRowspan,
        Math.max(1, remainingRowCount - rowIndex)
      );

      const inputs = $cell.find('input, textarea, select');

      if (inputs.length > 1) {
        const firstInput = inputs.first();
        const field = extractField($, firstInput, cellIndex);
        row.cells.push(
          mapEditableCell(field, colspan, safeRowspan, rowId, cellIndex)
        );
        return;
      }

      const input = inputs.first();

      if (input.length) {
        const field = extractField($, input, cellIndex);
        row.cells.push(
          mapEditableCell(field, colspan, safeRowspan, rowId, cellIndex)
        );
      } else {
        row.cells.push(
          buildStaticCell(
            cellIndex,
            normalizeText($cell.text()),
            colspan,
            safeRowspan,
            rowId,
            'center'
          )
        );
      }
    });

    if (row.cells.length) rows.push(row);
  });

  return {
    id: baseId,
    sectionType: 'matrixTable',
    title: sectionTitle,
    topHeaders,
    columns,
    rows,
    showRowActions: detectRowActions($, $table),
    minRows: 1,
  };
}

function extractTables($, $section, sectionTitle) {
  const blocks = [];

  $section.find('table').each((tableIndex, table) => {
    const $table = $(table);
    if (isMatrixTable($, $table)) {
      blocks.push(extractMatrixTable($, $table, sectionTitle, tableIndex));
    } else {
      blocks.push(extractSimpleTable($, $table, sectionTitle, tableIndex));
    }
  });

  return blocks;
}

function shouldSplitSection(fields, tables) {
  const totalTableRows = tables.reduce((sum, t) => sum + (t.rows?.length || 0), 0);
  const largestTableRows = Math.max(0, ...tables.map((t) => t.rows?.length || 0));

  const safeOnePage =
    tables.length === 1 &&
    largestTableRows <= MAX_SINGLE_TABLE_ROWS &&
    fields.length <= 25;

  if (safeOnePage) return false;

  return (
    fields.length > MAX_FIELDS_PER_SECTION ||
    totalTableRows > MAX_TOTAL_TABLE_ROWS ||
    tables.length > MAX_TABLES_PER_SECTION
  );
}

function splitFieldsIntoSections(baseId, title, fields) {
  const chunks = [];
  for (let i = 0; i < fields.length; i += MAX_FIELDS_PER_SECTION) {
    chunks.push(fields.slice(i, i + MAX_FIELDS_PER_SECTION));
  }

  return chunks.map((chunk, index) => ({
    id: `${baseId}_part_${index + 1}`,
    title: `${title} - Part ${index + 1}`,
    sectionType: 'fields',
    fields: chunk,
    tables: [],
  }));
}

function splitTablesIntoSections(baseId, title, tables) {
  const result = [];
  let buffer = [];
  let rowCount = 0;

  for (const table of tables) {
    const currentRows = table.rows?.length || 0;

    if (
      buffer.length > 0 &&
      (rowCount + currentRows > MAX_TOTAL_TABLE_ROWS ||
        buffer.length >= MAX_TABLES_PER_SECTION)
    ) {
      result.push(buffer);
      buffer = [];
      rowCount = 0;
    }

    if (currentRows > MAX_SINGLE_TABLE_ROWS) {
      if (buffer.length) {
        result.push(buffer);
        buffer = [];
        rowCount = 0;
      }

      const splitRows = [];
      for (let i = 0; i < currentRows; i += MAX_SINGLE_TABLE_ROWS) {
        splitRows.push(table.rows.slice(i, i + MAX_SINGLE_TABLE_ROWS));
      }

      splitRows.forEach((rowChunk, chunkIndex) => {
        result.push([
          {
            ...table,
            id: `${table.id}_part_${chunkIndex + 1}`,
            title: `${table.title} - Part ${chunkIndex + 1}`,
            rows: rowChunk,
          },
        ]);
      });
      continue;
    }

    buffer.push(table);
    rowCount += currentRows;
  }

  if (buffer.length) result.push(buffer);

  return result.map((group, index) => ({
    id: `${baseId}_part_${index + 1}`,
    title: `${title} - Part ${index + 1}`,
    sectionType: group.length === 1 ? group[0].sectionType : 'hybrid',
    fields: [],
    tables: group,
  }));
}

function parseSection($, fieldset, sectionIndex) {
  const $fieldset = $(fieldset);
  const title =
    normalizeText($fieldset.find('legend').first().text()) ||
    `Section ${sectionIndex + 1}`;

  const baseId = slugify(title);
  const standaloneFields = extractStandaloneFields($, $fieldset);
  const tables = extractTables($, $fieldset, title);

  if (!shouldSplitSection(standaloneFields, tables)) {
    const section = {
      id: baseId,
      title,
      sectionType: 'hybrid',
      fields: standaloneFields,
      tables,
    };

    if (standaloneFields.length && !tables.length) {
      section.sectionType = 'fields';
    } else if (!standaloneFields.length && tables.length === 1 && tables[0].sectionType === 'simpleTable') {
      section.sectionType = 'simpleTable';
    } else if (!standaloneFields.length && tables.length === 1 && tables[0].sectionType === 'matrixTable') {
      section.sectionType = 'matrixTable';
    }

    return [section];
  }

  if (standaloneFields.length && !tables.length) {
    return splitFieldsIntoSections(baseId, title, standaloneFields);
  }

  if (!standaloneFields.length && tables.length) {
    return splitTablesIntoSections(baseId, title, tables);
  }

  return [
    {
      id: `${baseId}_part_1`,
      title: `${title} - Part 1`,
      sectionType: 'fields',
      fields: standaloneFields,
      tables: [],
    },
    ...splitTablesIntoSections(baseId, title, tables).map((s, i) => ({
      ...s,
      id: `${baseId}_part_${i + 2}`,
      title: `${title} - Part ${i + 2}`,
    })),
  ];
}

function parseForm(html, filename) {
  const cleaned = cleanDjangoTemplate(html);
  const $ = cheerio.load(cleaned);

  const schema = {
    formId: slugify(path.basename(filename, path.extname(filename))),
    title: getTitle($),
    sourceFile: path.basename(filename),
    sections: [],
  };

  const fieldsets = $('form fieldset');

  if (fieldsets.length) {
    fieldsets.each((i, fieldset) => {
      const sections = parseSection($, fieldset, i);
      schema.sections.push(...sections);
    });
  } else {
    const bodyFields = extractStandaloneFields($, $('form').first());
    schema.sections.push({
      id: 'main_section',
      title: 'Main Section',
      sectionType: 'fields',
      fields: bodyFields,
      tables: [],
    });
  }

  return schema;
}

async function main() {
  const inputArg = process.argv[2];
  const outputDir = process.argv[3] || './output-json';

  if (!inputArg) {
    console.log('Usage: node legacy-form-parser.js "<html-file-or-glob>" [output-dir]');
    process.exit(1);
  }

  const files = glob.sync(inputArg, { nodir: true });

  if (!files.length) {
    console.log('No files found.');
    process.exit(1);
  }

  await fs.ensureDir(outputDir);

  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const schema = parseForm(html, file);

    const outFile = path.join(
      outputDir,
      `${path.basename(file, path.extname(file))}.json`
    );

    await fs.writeJson(outFile, schema, { spaces: 2 });
    console.log(`Parsed: ${file} -> ${outFile}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// # Absolute paths
// node legacy-form-parser.js "/home/user/project/templates/form.html" "/home/user/project/output"

// # Relative paths
// node legacy-form-parser.js "./templates/legacy-forms/*.html" "./json-schemas"