import { RestEndpointMethodTypes } from '@octokit/rest'

declare global {
  function GM_setValue(key: string, v: any): void;
  function GM_getValue(key: string, def: any): any;
  function GM_registerMenuCommand(name: string, func: () => void): void;
}

export interface NotificationItem {
  title: string;
  el: HTMLElement
  url: string
  urlBare: string
  read: boolean,
  starred: boolean,
  type: string, 
  status: string,
  isClosed: boolean,
  markDone: () => void
  popupShow?: () => void
  popupHide?: () => void
}

export type Issue = RestEndpointMethodTypes['issues']['get']['response']['data']
// export type Pull = RestEndpointMethodTypes['pulls']['get']['response']['data']

export type Subject = Issue

export interface DetailsCache {
  url: string
  lastUpdated: number
  subject: Subject
  bodyHtml?: string
}


export {}
