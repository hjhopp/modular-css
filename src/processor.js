"use strict";

var fs   = require("fs"),
    path = require("path"),

    postcss = require("postcss"),
    Graph   = require("dependency-graph").DepGraph,
    
    parser = postcss([
        require("./plugins/values.js"),
        require("./plugins/scoping.js"),
        require("./plugins/composition.js")
    ]),
    
    imports = require("./imports");

function Processor() {
    this._queue = [];
    this._files = {};
    this._all   = new Graph();
}

Processor.prototype = {
    file : function(file) {
        return this.string(file, fs.readFileSync(file, "utf8"));
    },

    string : function(name, text) {
        var self  = this,
            start = path.relative(process.cwd(), name).replace(/\\/g, "/");

        this._local = new Graph();

        this._addNode(start);
        this._walk(start, text);

        this._local.overallOrder().forEach(function(file) {
            var details = self._files[file],
                parsed  = parser.process(details.text, {
                    from  : file,
                    files : self._files
                });
            
            details.parsed = parsed.css;
            
            parsed.messages.forEach(function(msg) {
                if(msg.values) {
                    details.values = msg.values;
                    
                    return;
                }
                
                if(msg.compositions) {
                    details.compositions = msg.compositions;
                    
                    return;
                }
            });
        });
        
        return {
            files   : this._files,
            exports : this._files[start].compositions
        };
    },

    get css() {
        var self = this,
            css  = [];
        
        this._all.overallOrder().forEach(function(file) {
            css.push(
                "/* " + file + " */",
                self._files[file].parsed
            );
        });

        return css.join("\n");
    },

    get files() {
        return this._files;
    },

    _addNode : function(name) {
        this._local.addNode(name);
        this._all.addNode(name);
    },

    _addDependency : function(from, to) {
        this._local.addDependency(from, to);
        this._all.addDependency(from, to);
    },

    _walk : function(name, text) {
        var self = this,
            css;

        function parse(field, rule) {
            var parsed = imports.parse(name, rule[field]);
            
            if(!parsed) {
                return;
            }
            
            this._addNode(parsed.source);
            this._addDependency(name, parsed.source);
        }
    
        // Avoid re-parsing
        if(!this._files[name]) {
            this._files[name] = {
                text : text
            };
            
            css = postcss.parse(text, { from : name });
            css.walkAtRules("value", parse.bind(this, "params"));
            css.walkDecls("composes", parse.bind(this, "value"));
        } else {
            // File already parsed so go figure out dep tree and copy it to the local graph
            this._all.dependenciesOf(name).forEach(function(dependency) {
                self._local.addNode(dependency);
                self._local.addDependency(name, dependency);
            });
        }
        
        this._local.dependenciesOf(name).forEach(function(dependency) {
            // Walk, but don't re-read files that've already been handled
            self._walk(
                dependency,
                self._files[dependency] ? null : fs.readFileSync(dependency, "utf8")
            );
        });
    }
};

module.exports = Processor;