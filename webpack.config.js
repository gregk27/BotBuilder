module.exports = {
    mode: "none",
    module:{
        rules:[
            {
                test: /\.ts$/,
                use:"ts-loader"
            }
        ]
    },
    entry:{
        webviews: [
            "./resources/html/scripts/argumentSelector.ts",
            "./resources/html/scripts/inputLineManager.ts"
        ]
    },
    output:{
        filename:"bundle.js",
        path:__dirname+"/resources/html/"
    },
    resolve:{
        extensions: ['.ts']
    }
};