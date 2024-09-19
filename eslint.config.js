import antfu from '@antfu/eslint-config'

export default antfu({
  languageOptions: {
    globals: {
      GM_getValue: 'readonly',
      GM_setValue: 'readonly',
      GM_addValueChangeListener: 'readonly',
      GM_removeValueChangeListener: 'readonly',
      GM_registerMenuCommand: 'readonly',
    },
  },
})
