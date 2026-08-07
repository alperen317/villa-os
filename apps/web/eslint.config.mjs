import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {
      // ng-zorro's `<label nz-checkbox>` is a self-contained control: the
      // directive renders its own `<input type="checkbox">` inside the label at
      // runtime, so the static template has no nested control for the rule to
      // find. Treating `nz-checkbox` like `for` keeps the rule useful for plain
      // labels without flagging the library idiom.
      '@angular-eslint/template/label-has-associated-control': [
        'error',
        {
          labelComponents: [
            { selector: 'label', inputs: ['for', 'htmlFor', 'nz-checkbox'] },
          ],
        },
      ],
    },
  },
];
