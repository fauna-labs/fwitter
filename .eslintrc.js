module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true
  },
  extends: [
    'prettier-standard',
    'plugin:react/recommended'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2018,
    sourceType: 'module'
  },
  plugins: [
    'react',
    'jest'
  ],
  rules: {
    'one-var': 0,
    'func-names': 0,
    'prettier/prettier': [
      'error',
      {
        'singleQuote': true,
        'printWidth': 120,
        'semi': false
      }
    ]
  }
}
