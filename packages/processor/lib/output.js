"use strict";

const map = require("lodash/mapValues");

const relative = require("./relative.js");

exports.join = function(output) {
    return map(output, (classes) => (
        Array.isArray(classes) ?
            classes.join(" ") :
            classes.toString()
    ));
};

exports.compositions = function(cwd, processor) {
    var json = {};
    
    Object.keys(processor.files)
        .sort()
        .forEach((file) =>
            (json[relative(cwd, file)] = exports.join(processor.files[file].exports))
        );
    
    return json;
};
