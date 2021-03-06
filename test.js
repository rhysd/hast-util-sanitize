/**
 * @author Titus Wormer
 * @copyright 2016 Titus Wormer
 * @license MIT
 * @module hast-util-sanitize
 * @fileoverview Test suite for `hast-util-sanitize`.
 */

'use strict';

/* Dependencies. */
var test = require('tape');
var html = require('hast-util-to-html');
var h = require('hastscript');
var u = require('unist-builder');
var merge = require('deepmerge');
var gh = require('./lib/github');
var sanitize = require('./index.js');

/* eslint-disable no-script-url, max-params */

/* Check */
function toString() {
  return 'alert(1);';
}

/* Coverage. */
toString();

/* Test `valid` `url`s in `prop` on `tagName`. */
function testURLs(t, tagName, prop, urls, valid) {
  Object.keys(urls).forEach(function (name) {
    var props = {};

    props[prop] = urls[name];

    t.deepEqual(
      sanitize(h(tagName, props)),
      h(tagName, valid ? props : {}),
      'should ' + (valid ? 'allow' : 'clean') + ' ' + name
    );
  });
}

/* Test `valid` and `invalid` `url`s in `prop` on `tagName`. */
function testAllURLs(t, tagName, prop, all) {
  testURLs(t, tagName, prop, all.valid, true);
  testURLs(t, tagName, prop, all.invalid, false);
}

/* Tests. */
test('sanitize()', function (t) {
  t.test('non-node', function (st) {
    st.equal(html(sanitize(true)), '', 'should ignore non-nodes (#1)');
    st.equal(html(sanitize(null)), '', 'should ignore non-nodes (#2)');
    st.equal(html(sanitize(1)), '', 'should ignore non-nodes (#3)');
    st.equal(html(sanitize([])), '', 'should ignore non-nodes (#4)');

    st.end();
  });

  t.test('unknown nodes', function (st) {
    st.equal(
      html(sanitize(u('unknown', '<xml></xml>'))),
      '',
      'should ignore unknown nodes'
    );

    st.end();
  });

  t.test('ignored nodes', function (st) {
    st.equal(
      html(sanitize(u('raw', '<xml></xml>'))),
      '',
      'should ignore `raw`'
    );

    st.equal(
      html(sanitize(u('directive', {name: '!alpha'}, '!alpha bravo'))),
      '',
      'should ignore declaration `directive`s'
    );

    st.equal(
      html(sanitize(u('directive', {name: '?xml'}, '?xml version="1.0"'))),
      '',
      'should ignore processing instruction `directive`s'
    );

    st.equal(
      html(sanitize(u('characterData', 'alpha'))),
      '',
      'should ignore `characterData`s'
    );

    st.equal(
      html(sanitize(u('comment', 'alpha'))),
      '',
      'should ignore `comment`s'
    );

    st.end();
  });

  t.test('`text`', function (st) {
    st.deepEqual(
      sanitize({
        type: 'text',
        tagName: 'div',
        value: 'alert(1)',
        unknown: 'alert(1)',
        properties: {href: 'javascript:alert(1)'},
        children: [h('script', 'alert(1)')],
        data: {href: 'alert(1)'},
        position: {
          start: {line: 1, column: 1},
          end: {line: 2, column: 1}
        }
      }),
      {
        type: 'text',
        value: 'alert(1)',
        data: {href: 'alert(1)'},
        position: {
          start: {line: 1, column: 1},
          end: {line: 2, column: 1}
        }
      },
      'should allow known properties'
    );

    st.equal(
      html(sanitize(u('text', 'alert(1)'))),
      'alert(1)',
      'should allow `text`'
    );

    st.equal(
      html(sanitize(u('text', {toString: toString}))),
      '',
      'should ignore non-string `value`s'
    );

    st.equal(
      html(sanitize(h('script', u('text', 'alert(1)')))),
      '',
      'should ignore `text` in `script` elements'
    );

    st.equal(
      html(sanitize(h('style', u('text', 'alert(1)')))),
      'alert(1)',
      'should show `text` in `style` elements'
    );

    st.end();
  });

  t.test('`element`', function (st) {
    st.deepEqual(
      sanitize({
        type: 'element',
        tagName: 'div',
        value: 'alert(1)',
        unknown: 'alert(1)',
        properties: {href: 'javascript:alert(1)'},
        children: [h('script', 'alert(1)')],
        data: {href: 'alert(1)'},
        position: {
          start: {line: 1, column: 1},
          end: {line: 2, column: 1}
        }
      }),
      {
        type: 'element',
        tagName: 'div',
        properties: {},
        children: [],
        data: {href: 'alert(1)'},
        position: {
          start: {line: 1, column: 1},
          end: {line: 2, column: 1}
        }
      },
      'should allow known properties'
    );

    st.deepEqual(
      sanitize(h('unknown', u('text', 'alert(1)'))),
      u('text', 'alert(1)'),
      'should ignore unknown elements'
    );

    st.deepEqual(
      sanitize({
        type: 'element',
        properties: {},
        children: [u('text', 'alert(1)')]
      }),
      u('text', 'alert(1)'),
      'should ignore elements without name'
    );

    st.deepEqual(
      sanitize({
        type: 'element',
        tagName: 'div'
      }),
      h(),
      'should support elements without children / properties'
    );

    st.deepEqual(
      sanitize(h('unknown', [])),
      u('root', []),
      'should always return a valid node (#1)'
    );

    st.deepEqual(
      sanitize(h('script', [])),
      u('root', []),
      'should always return a valid node (#2)'
    );

    st.deepEqual(
      sanitize(h('div', h('style', [u('text', '1'), u('text', '2')]))),
      h('div', [u('text', '1'), u('text', '2')]),
      'should always return a valid node (#3)'
    );

    st.deepEqual(
      sanitize(h('unknown', [u('text', 'value')])),
      u('text', 'value'),
      'should always return a valid node (#4)'
    );

    st.deepEqual(
      sanitize(h('unknown', [u('text', '1'), u('text', '2')])),
      u('root', [u('text', '1'), u('text', '2')]),
      'should always return a valid node (#5)'
    );

    st.deepEqual(
      sanitize(h('div', {alt: 'alpha'})),
      h('div', {alt: 'alpha'}),
      'should allow known generic properties'
    );

    st.deepEqual(
      sanitize(h('a', {href: '#heading'})),
      h('a', {href: '#heading'}),
      'should allow specific properties'
    );

    st.deepEqual(
      sanitize(h('img', {href: '#heading'})),
      h('img'),
      'should ignore mismatched specific properties'
    );

    st.deepEqual(
      sanitize(h('div', {dataFoo: 'bar'})),
      h('div'),
      'should ignore unspecified properties'
    );

    st.deepEqual(
      sanitize(h('div', {dataFoo: 'bar'})),
      h('div'),
      'should ignore unspecified properties'
    );

    st.deepEqual(
      sanitize(
        h('div', {dataFoo: 'bar'}),
        merge(gh, {attributes: {'*': ['data*']}})
      ),
      h('div', {dataFoo: 'bar'}),
      'should allow `data*`'
    );

    st.deepEqual(
      sanitize(h('img', {alt: 'hello'})),
      h('img', {alt: 'hello'}),
      'should allow `string`s'
    );

    st.deepEqual(
      sanitize(h('img', {alt: true})),
      h('img', {alt: true}),
      'should allow `boolean`s'
    );

    st.deepEqual(
      sanitize(h('img', {alt: 1})),
      h('img', {alt: 1}),
      'should allow `number`s'
    );

    st.deepEqual(
      sanitize(u('element', {
        tagName: 'img',
        properties: {alt: null}
      })),
      h('img'),
      'should ignore `null`'
    );

    st.deepEqual(
      sanitize(u('element', {
        tagName: 'img',
        properties: {alt: undefined}
      })),
      h('img'),
      'should ignore `undefined`'
    );

    st.deepEqual(
      sanitize(h('div', {id: 'getElementById'})),
      h('div', {id: 'user-content-getElementById'}),
      'should prevent clobbering (#1)'
    );

    st.deepEqual(
      sanitize(h('div', {name: 'getElementById'})),
      h('div', {name: 'user-content-getElementById'}),
      'should prevent clobbering (#1)'
    );

    st.deepEqual(
      sanitize(u('element', {
        tagName: 'img',
        properties: {alt: {toString: toString}}
      })),
      h('img'),
      'should ignore objects'
    );

    st.deepEqual(
      sanitize(u('element', {
        tagName: 'img',
        properties: {
          alt: [1, true, 'three', [4], {toString: toString}]
        }
      })),
      h('img', {alt: [1, true, 'three']}),
      'should supports arrays'
    );

    st.test('href`', function (sst) {
      testAllURLs(sst, 'a', 'href', {
        valid: {
          'anchor': '#heading',
          'relative': '/file.html',
          'search': 'example.com?foo:bar',
          'hash': 'example.com#foo:bar',
          'protocol-less': 'www.example.com',
          'mailto': 'mailto:foo@bar.com',
          'https': 'http://example.com',
          'http': 'http://example.com'
        },
        invalid: {
          'javascript': 'javascript:alert(1)',
          'Unicode LS/PS I': '\u2028javascript:alert(1)',
          'Unicode Whitespace (#1)': ' javascript:alert(1)',
          'Unicode Whitespace (#2)': ' javascript:alert(1)',
          'infinity loop': 'javascript:while(1){}',
          'data URL': 'data:,evilnastystuff'
        }
      });

      sst.end();
    });

    st.test('`cite`', function (sst) {
      testAllURLs(sst, 'blockquote', 'cite', {
        valid: {
          'anchor': '#heading',
          'relative': '/file.html',
          'search': 'example.com?foo:bar',
          'hash': 'example.com#foo:bar',
          'protocol-less': 'www.example.com',
          'https': 'http://example.com',
          'http': 'http://example.com'
        },
        invalid: {
          'mailto': 'mailto:foo@bar.com',
          'javascript': 'javascript:alert(1)',
          'Unicode LS/PS I': '\u2028javascript:alert(1)',
          'Unicode Whitespace (#1)': ' javascript:alert(1)',
          'Unicode Whitespace (#2)': ' javascript:alert(1)',
          'infinity loop': 'javascript:while(1){}',
          'data URL': 'data:,evilnastystuff'
        }
      });

      sst.end();
    });

    st.test('`src`', function (sst) {
      testAllURLs(sst, 'img', 'src', {
        valid: {
          'anchor': '#heading',
          'relative': '/file.html',
          'search': 'example.com?foo:bar',
          'hash': 'example.com#foo:bar',
          'protocol-less': 'www.example.com',
          'https': 'http://example.com',
          'http': 'http://example.com'
        },
        invalid: {
          'mailto': 'mailto:foo@bar.com',
          'javascript': 'javascript:alert(1)',
          'Unicode LS/PS I': '\u2028javascript:alert(1)',
          'Unicode Whitespace (#1)': ' javascript:alert(1)',
          'Unicode Whitespace (#2)': ' javascript:alert(1)',
          'infinity loop': 'javascript:while(1){}',
          'data URL': 'data:,evilnastystuff'
        }
      });

      sst.end();
    });

    st.test('`longDesc`', function (sst) {
      testAllURLs(sst, 'img', 'longDesc', {
        valid: {
          'anchor': '#heading',
          'relative': '/file.html',
          'search': 'example.com?foo:bar',
          'hash': 'example.com#foo:bar',
          'protocol-less': 'www.example.com',
          'https': 'http://example.com',
          'http': 'http://example.com'
        },
        invalid: {
          'mailto': 'mailto:foo@bar.com',
          'javascript': 'javascript:alert(1)',
          'Unicode LS/PS I': '\u2028javascript:alert(1)',
          'Unicode Whitespace (#1)': ' javascript:alert(1)',
          'Unicode Whitespace (#2)': ' javascript:alert(1)',
          'infinity loop': 'javascript:while(1){}',
          'data URL': 'data:,evilnastystuff'
        }
      });

      sst.end();
    });

    st.test('`li`', function (sst) {
      sst.deepEqual(
        sanitize(h('li', 'alert(1)')),
        u('text', 'alert(1)'),
        'should not allow `li` outside list'
      );

      sst.deepEqual(
        sanitize(h('ol', h('li', 'alert(1)'))),
        h('ol', h('li', 'alert(1)')),
        'should allow `li` in `ol`'
      );

      sst.deepEqual(
        sanitize(h('ul', h('li', 'alert(1)'))),
        h('ul', h('li', 'alert(1)')),
        'should allow `li` in `ul`'
      );

      sst.deepEqual(
        sanitize(h('ol', h('div', h('li', 'alert(1)')))),
        h('ol', h('div', h('li', 'alert(1)'))),
        'should allow `li` descendant `ol`'
      );

      sst.deepEqual(
        sanitize(h('ul', h('div', h('li', 'alert(1)')))),
        h('ul', h('div', h('li', 'alert(1)'))),
        'should allow `li` descendant `ul`'
      );

      sst.end();
    });

    ['tr', 'td', 'th', 'tbody', 'thead', 'tfoot'].forEach(function (name) {
      st.test('`' + name + '`', function (sst) {
        sst.deepEqual(
          sanitize(h(name, 'alert(1)')),
          u('text', 'alert(1)'),
          'should not allow `' + name + '` outside `table`'
        );

        sst.deepEqual(
          sanitize(h('table', h(name, 'alert(1)'))),
          h('table', h(name, 'alert(1)')),
          'should allow `' + name + '` in `table`'
        );

        sst.deepEqual(
          sanitize(h('table', h('div', h(name, 'alert(1)')))),
          h('table', h('div', h(name, 'alert(1)'))),
          'should allow `' + name + '` descendant `table`'
        );

        sst.end();
      });
    });

    st.end();
  });

  t.test('`root`', function (st) {
    st.deepEqual(
      sanitize({
        type: 'root',
        tagName: 'div',
        value: 'alert(1)',
        unknown: 'alert(1)',
        properties: {href: 'javascript:alert(1)'},
        children: [h('script', 'alert(1)')],
        data: {href: 'alert(1)'},
        position: {
          start: {line: 1, column: 1},
          end: {line: 2, column: 1}
        }
      }),
      {
        type: 'root',
        children: [],
        data: {href: 'alert(1)'},
        position: {
          start: {line: 1, column: 1},
          end: {line: 2, column: 1}
        }
      },
      'should allow known properties'
    );

    st.end();
  });

  t.end();
});
