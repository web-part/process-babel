const $Date = require('@definejs/date');
const MD5 = require('@definejs/md5');

module.exports = {

    /**
    * 生成文件头的注释。
    * @returns {Array} 返回注释的行数组。
    *   content: '',    //必选。 要转码的 js 内容。
    *   opt = {
    *       md5: '',    //可选。 要转码的 js 内容对应的 md5 值，如果不指定，则重新计算。
    *       file: '',   //可选。 源文件路径。
    *       list: [],   //可选。 多个源文件的列表。 如果指定了此字段，则忽略 file 字段。
    *   };
    */
    get(content, opt) {
        if (!opt) {
            return [];
        }

        let md5 = opt.md5 || MD5.get(content);
        let file = opt.file || '(none)';
        let list = opt.list || [];

        //生成的格式如：
        //* source file: 3 files:
        //*   htdocs/views/subject/Subject/API.js
        //*   htdocs/views/subject/Subject/List.js
        //*   htdocs/views/subject/Subject.js
        if (list.length > 0) {
            file = list.length + ' files:';

            list = list.map(function (item) {
                return '*   ' + item;
            });

            file = [file, ...list].join('\r\n');
        }


        let lines = [
            '/*',
            '* babel time: ' + $Date.format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
            '*',
            '* source md5: ' + md5,
            '*',
            '* source file: ' + file,
            '*/',
            '',
            '',
        ];

        return lines; 

    },
};