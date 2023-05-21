declare global {
  function GM_setValue(key: string, v: any): void;
  function GM_getValue(key: string, def: any): any;
  function GM_registerMenuCommand(name: string, func: () => void): void;
}

export {}
