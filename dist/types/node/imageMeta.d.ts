type LongImageMode = "auto" | "always" | "off";
type AdaptiveImageOptions = {
    mode?: LongImageMode;
    ratioThreshold?: number;
    maxHeightVh?: number;
};
export declare function applyAdaptiveImageInteractions(root: HTMLElement, relativePath?: string, options?: AdaptiveImageOptions): Promise<void>;
export {};
