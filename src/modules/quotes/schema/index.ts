// src/modules/quotes/schema/index.ts
export type CardType = 'header'|'text'|'table'|'divider'|'footer';

export type HeaderCard = { type:'header'; text:string };
export type TextCard   = { type:'text';   text:string };
export type TableRow   = { item?:string; qty?:number; price?:number };
export type TableCard  = { type:'table';  rows:TableRow[] };
export type DividerCard= { type:'divider' };
export type FooterCard = { type:'footer'; showPageNumbers?:boolean; showFirmInfo?:boolean };

export type QuoteSchema = {
  sections: Array<HeaderCard|TextCard|TableCard|DividerCard|FooterCard>;
  style?: { fontFamily?: string };
  page?:  { margin?: string };
}
