import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { z } from 'zod';
import { ConversionVisitor, EvalVisitor } from '../../../formula';
import { FieldReferenceVisitor } from '../../../formula/field-reference.visitor';
import type { RootContext } from '../../../formula/parser/Formula';
import { Formula } from '../../../formula/parser/Formula';
import { FormulaLexer } from '../../../formula/parser/FormulaLexer';
import type { IRecord } from '../../record';
import type { FieldType, DbFieldType } from '../constant';
import type { CellValueType } from '../field';
import { FieldCore } from '../field';
import type { NumberFieldOptions } from './number.field';

export class FormulaFieldOptions {
  expression!: string;

  formatting?: NumberFieldOptions;
}

export class FormulaFieldCore extends FieldCore {
  static parse(expression: string) {
    const inputStream = CharStreams.fromString(expression);
    const lexer = new FormulaLexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new Formula(tokenStream);
    return parser.root();
  }

  static getParsedValueType(expression: string, dependFieldMap: { [fieldId: string]: FieldCore }) {
    const tree = this.parse(expression);
    const visitor = new EvalVisitor(dependFieldMap);
    const typedValue = visitor.visit(tree);
    return {
      cellValueType: typedValue.type,
      cellValueElementType: 'elementType' in typedValue && typedValue.elementType,
    };
  }

  static convertExpressionIdToName(
    expression: string,
    dependFieldMap: { [fieldId: string]: FieldCore }
  ) {
    const tree = this.parse(expression);
    const idToName = Object.entries(dependFieldMap).reduce<{ [fieldId: string]: string }>(
      (acc, [fieldId, field]) => {
        acc[fieldId] = field.name;
        return acc;
      },
      {}
    );
    const visitor = new ConversionVisitor(idToName);
    visitor.visit(tree);
    return visitor.getResult();
  }

  static convertExpressionNameToId(
    expression: string,
    dependFieldMap: { [fieldId: string]: FieldCore }
  ) {
    const tree = this.parse(expression);
    const idToName = Object.entries(dependFieldMap).reduce<{ [fieldName: string]: string }>(
      (acc, [fieldId, field]) => {
        acc[field.name] = fieldId;
        return acc;
      },
      {}
    );
    const visitor = new ConversionVisitor(idToName);
    visitor.visit(tree);
    return visitor.getResult();
  }

  type!: FieldType.Formula;

  dbFieldType!: DbFieldType;

  options!: FormulaFieldOptions;

  defaultValue!: null;

  calculatedType!: FieldType.Formula;

  cellValueType!: CellValueType;

  declare cellValueElementType?: CellValueType;

  isComputed!: true;

  private _tree?: RootContext;

  get tree() {
    if (this._tree) {
      return this._tree;
    }
    this._tree = FormulaFieldCore.parse(this.options.expression);
    return this._tree;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellValue2String(cellValue: any) {
    if (Array.isArray(cellValue)) {
      return cellValue.join(', ');
    }
    return cellValue ? String(cellValue) : '';
  }

  convertStringToCellValue(_value: string): string[] | null {
    return null;
  }

  repair(value: unknown) {
    return value;
  }

  validateOptions() {
    return z
      .object({
        expression: z.string(),
        formatting: z
          .object({
            precision: z.number().max(5).min(0),
          })
          .optional(),
      })
      .safeParse(this.options);
  }

  validateDefaultValue() {
    return z.null().safeParse(this.defaultValue);
  }

  getReferenceFieldIds() {
    const visitor = new FieldReferenceVisitor();
    return Array.from(new Set(visitor.visit(this.tree)));
  }

  evaluate(dependFieldMap: { [fieldId: string]: FieldCore }, record?: IRecord) {
    const visitor = new EvalVisitor(dependFieldMap, record);
    return visitor.visit(this.tree);
  }
}
