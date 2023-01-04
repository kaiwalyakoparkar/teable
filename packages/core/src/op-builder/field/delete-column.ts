import type { IColumn, IOtOperation } from '../../models';
import { OpName, pathMatcher } from '../common';
import type { IOpBuilder } from '../interface';

export interface IDeleteColumnOpContext {
  name: OpName.DeleteColumn;
  columnIndex: number;
  viewId: string;
  column: IColumn;
}

export class DeleteColumnBuilder implements IOpBuilder {
  name: OpName.DeleteColumn = OpName.DeleteColumn;

  build(params: { columnIndex: number; viewId: string; column: IColumn }): IOtOperation {
    const { viewId, columnIndex, column } = params;

    return {
      p: ['viewMap', viewId, 'columns', columnIndex],
      ld: column,
    };
  }

  detect(op: IOtOperation): IDeleteColumnOpContext | null {
    const { p, li, ld } = op;
    if (!ld || li) {
      return null;
    }

    const result = pathMatcher<{ viewId: string; columnIndex: number }>(p, [
      'viewMap',
      ':viewId',
      'columns',
      ':columnIndex',
    ]);

    if (!result) {
      return null;
    }

    const column: IColumn = li;
    return {
      name: this.name,
      columnIndex: result.columnIndex,
      viewId: result.viewId,
      column,
    };
  }
}
