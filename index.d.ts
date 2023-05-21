declare global {
  function GM_setValue(key: string, v: any): void;
  function GM_getValue(key: string, def: any): any;
  function GM_registerMenuCommand(name: string, func: () => void): void;
}

export interface NotificationItem {
  title: string;
  el: HTMLElement
  url: string
  read: boolean,
  starred: boolean,
  type: string, 
  status: string,
  isClosed: boolean,
  markDone: () => void
}

export {}
