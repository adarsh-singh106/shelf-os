import type { Database } from './database.types'

type PublicSchema = Database['public']

export type TableName = keyof PublicSchema['Tables']
export type ViewName = keyof PublicSchema['Views']
export type FunctionName = keyof PublicSchema['Functions']

export type TableRow<T extends TableName> = PublicSchema['Tables'][T]['Row']
export type TableInsert<T extends TableName> = PublicSchema['Tables'][T]['Insert']
export type TableUpdate<T extends TableName> = PublicSchema['Tables'][T]['Update']
export type ViewRow<V extends ViewName> = PublicSchema['Views'][V]['Row']
export type FunctionReturn<F extends FunctionName> = PublicSchema['Functions'][F]['Returns']