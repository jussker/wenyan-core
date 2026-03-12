import "@mathjax/src/js/input/tex/ams/AmsConfiguration.js";
import "@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js";
import "@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js";
import "@mathjax/src/js/input/tex/autoload/AutoloadConfiguration.js";
import "@mathjax/src/js/input/tex/require/RequireConfiguration.js";
import "@mathjax/src/js/input/tex/configmacros/ConfigMacrosConfiguration.js";
export interface MathJaxParserOptions {
    inlineMath?: [string, string][];
    displayMath?: [string, string][];
    fontCache?: "none" | "local" | "global";
}
export declare function createMathJaxParser(options?: MathJaxParserOptions): {
    parser(htmlString: string): string;
};
