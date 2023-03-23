
const console = require('@webpart/console');
const Babel = require('@babel/core');
const MD5 = require('@definejs/md5');
const File = require('@definejs/file');
const Master = require('@webpart/master');
const Comment = require('./modules/Comment');
const Istanbul = require('babel-plugin-istanbul');

const dest$md5 = {};


function log(file) {
    console.log('babel 转换'.bgCyan, file.cyan);
}


module.exports = exports = {
    /**
    * 对指定的 js 内容进行 babel 转码。
    * 返回转码后的内容。
    *   content: '',            //必选，要转码的 js 内容。
    *   opt = {                 //必选，配置对象。
    *       babel: false,       //可选，是否进行常规的 babel 转换，即使用 `@babel/preset-env`。
    *       cover: false,       //可选，是否使用 istanbul 进行代码覆盖率插桩。
    *       comment: false,     //可选，是否在输出的内容顶部生成注释。
    *       md5: '',            //可选，要转码的 js 内容对应的 md5 值，如果不指定，则重新计算。
    *       file: '',           //可选，源文件路径。 
    *       list: [],           //可选，多个源文件的列表。 如果指定了此字段，则忽略 file 字段。
    *   };
    */
    transform(content, opt) {
        let presets = [];
        let plugins = [];

        //转换成兼容模式代码。
        if (opt.babel) {
            //此处提供静态的 require 语句以用于工具的分析。
            /* require('@babel/preset-env'); */
            presets.push('@babel/preset-env');
        }

        //插入代码覆盖率。
        if (opt.cover) {
            plugins.push(Istanbul);
        }

        //既没指定 babel，也没指定 cover。
        if (presets.length + plugins.length == 0) {
            return content;
        }


        let { code, } = Babel.transform(content, {
            presets,
            plugins,
            filename: opt.file,
            // compact: false,
        });

        let lines = Comment.get(content, opt);
        let strict = false;

        if (opt.babel) {
            strict = code.startsWith("'use strict';") || code.startsWith('"use strict";');
        }


        if (strict) {
            lines = [
                ...lines,
                '//' + code.slice(0, 13) + ' //取消 babel 自动生成的严格模式。',
                code.slice(14),
            ];
        }
        else {
            lines = [
                ...lines,
                code,
            ];
        }

        content = lines.join('\r\n');


        return content;
    },

    /**
    * 对指定的 js 文件进行 babel 转码。
    * @params {string} file 要进行 babel 转码的 js 文件路径。
    * @param {Object} opt 
    *   opt = {                 //必选，配置对象。
    *       babel: false,       //可选，是否进行常规的 babel 转换，即使用 `@babel/preset-env`。
    *       cover: false,       //可选，是否使用 istanbul 进行代码覆盖率插桩。
    *       comment: false,     //可选，是否在输出的内容顶部生成注释。
    *       dest: '',           //可选，要输出的目标文件，如果指定，则生成文件。
    *   };
    * @returns {string} 返回转码后的内容。
    */
    transformFile(file, opt) {
        let content = File.read(file);
        let md5 = MD5.get(content);
        let { dest, } = opt;

        if (dest && dest$md5[dest] == md5) {
            return;
        }

        log(file);

        content = exports.transform(content, {
            'babel': opt.babel,
            'cover': opt.cover,
            'comment': opt.comment,
            'file': file,
            'md5': md5,
        });

        if (dest) {
            dest$md5[dest] = md5;
            File.write(dest, content);
        }

        return content;
    },



    /**
    * 对 js 文件作 babel 转码，生成并返回相应的 `<script>` 标签 html 内容。
    * 该方法用于开发阶段，由 `webpart watch --compat|--cover` 调用。
    * 用于从 master 文件生成 html 文件后，对 html 文件内容进行后处理。
    * @params {string} file 要引入并进行 babel 转码的 js 文件路径。
    * @params {object} data 
    *   data = {
    *       md5: '',        //
    *       dir: '',        //
    *   };
    * @params {object} opt
    *   opt = {
    *       htdocs: '',         //必选，网站的根目录，如 `htdocs/`。
    *       dir: '',            //必选，转换后的 js 文件要存放的目录，如 `babel/`。
    *       babel: false,       //可选，是否进行常规的 babel 转换，即使用 `@babel/preset-env`。
    *       cover: false,       //可选，是否使用 istanbul 进行代码覆盖率插桩。
    *       comment: false,     //可选，是否在输出的内容顶部生成注释。
    *   };
    * @returns {string} 返回生成后的 html 内容。
    */
    render(file, data, opt) {
        let Path = Master.require('Path');
        let Js = Master.require('Js');


        let md5 = data.md5;                         //js 文件所对应的 md5 值。
        let { htdocs, dir, } = opt;

        //如 `html/redirect/index.js`。
        let dest = Path.relative(htdocs, file);

        //如 `htdocs/babel/html/redirect/index.js`。
        dest = htdocs + dir + dest;

        //根据 html 页面所在的目录，计算出新的 href。
        let href = Path.relative(data.dir, dest);


        //要 babel 的目标文件的 md5 跟输入的不一致，需要重新 babel。
        if (dest$md5[dest] != md5) {
            log(file);
            dest$md5[dest] = md5;

            let content = File.read(file);

            content = exports.transform(content, {
                'babel': opt.babel,
                'cover': opt.cover,
                'comment': opt.comment,

                'md5': md5,
                'file': file,
            });

            File.write(dest, content);
        }



        let html = '';


        //只有明确指定了内联，且为内部文件时，才能内联。
        if (data.inline && !data.external) {
            html = Js.inline({
                'file': dest,
                'comment': true, //此处简单以文件路径作为注释。
                'props': data.props,
                'tabs': data.tabs,
            });
        }
        else {
            html = Js.mix({
                'href': href,
                'props': data.props,
                'tabs': data.tabs,
                'query': data.query,
            });
        }


        return html;
    },

    /**
    * 该方法用于构建阶段，由 `webpart build --compat` 调用。
    * @params {string} mode 模式。 兼容模式或标准模式。
    * @params {Array} links JsLinks 实例数组。
    */
    build(mode, links) {
        let no$line = {}; //修改后的行号与内容。 

        links.forEach(function (item) {
            let meta = item.meta;

            //删除所有非目标模式（已经指定了具体的模式）的 script 标签。
            if (meta.mode && meta.mode != mode) {
                no$line[item.no] = '';
                return;
            }

            //除非显式指定 `babel=no;`，否则都做 babel 转码。
            if (meta.babel == 'no') {
                return;
            }


            //针对 `babel=.;` 的情况，作 babel 转换，且输出为原文件名。
            if (meta.babel == '.') {
                let file = item.file;
                exports.transformFile(file, {
                    'babel': true,
                    'cover': false,
                    'comment': false,
                    'dest': file,
                });
                return;
            }


            //其它情况，作 babel 转码，且输出带 `.babel.` 的文件。

            let ext = item.ext;                     //如 `.debug.js`。
            let href = item.href;                   //如 `f/polyfill/polyfill.debug.js`。

            let pos = 0 - ext.length;               //如 -9。
            let ext2 = '.babel' + ext;              //如 `.babel.debug.js`。
            let href2 = href.slice(0, pos) + ext2;  //如 `f/polyfill/polyfill.babel.debug.js`。

            let html = item.html;                   //如 `<script src="f/polyfill/polyfill.debug.js" data-meta="mode=compat; babel=false;"></script>`。
            let html2 = html.replace(href, href2);  //如 `<script src="f/polyfill/polyfill.bable.debug.js" data-meta="type=compat; babel=false;"></script>`。

            let line = item.line;                   //如 `    <script src="f/polyfill/polyfill.debug.js" data-meta="type=compat; babel=false;"></script>`
            let line2 = line.replace(html, html2);  //如 `    <script src="f/polyfill/polyfill.bable.debug.js" data-meta="type=compat; babel=false;"></script>`

            let file = item.file;                   //如 `htdocs/f/polyfill/polyfill.debug.js`
            let dest = file.slice(0, pos) + ext2;   //如 `htdocs/f/polyfill/polyfill.babel.debug.js`。

            exports.transformFile(file, {
                'babel': true,
                'cover': false,
                'comment': false,
                'dest': dest,
            });

            no$line[item.no] = line2;

        });

        return no$line;


    },

};