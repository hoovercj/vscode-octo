export interface OctoOptions {
    tickrate: number;
    fillColor: string;
    fillColor2: string;
    blendColor: string;
    backgroundColor: string;
    buzzColor: string;
    quietColor: string;
    shiftQuirks: boolean;
    loadStoreQuirks: boolean;
    vfOrderQuirks: boolean;
    clipQuirks: boolean;
    jumpQuirks: boolean;
    enableXO: boolean;
    screenRotation: number;
    numericMask: boolean;
    numericFormat: string;
}

export interface OctoColor {
    theme: string;
    fillColor: string;
    fillColor2: string;
    blendColor: string;
    backgroundColor: string;
    buzzColor: string;
    quietColor: string;
}

export interface OctoConfig {
    tickrate: number;
    color: OctoColor;
    shiftQuirks: boolean;
    loadStoreQuirks: boolean;
    vfOrderQuirks: boolean;
    clipQuirks: boolean;
    jumpQuirks: boolean;
    enableXO: boolean;
    screenRotation: number;
    theme: string;
}

export function GetTheme(config: OctoColor) {
    return OctoThemes[config.theme] || {
        "backgroundColor": config.backgroundColor,
        "fillColor": config.fillColor,
        "fillColor2": config.fillColor2,
        "blendColor": config.blendColor,
        "buzzColor": config.buzzColor,
        "quietColor": config.quietColor
    }
}

let OctoThemes = {
    "OctoClassic": {
        backgroundColor: "#996600",
        fillColor: "#FFCC00",
        fillColor2: "#FF6600",
        blendColor: "#662200",
        buzzColor: "#FFAA00",
        quietColor: "#000000"
    },
    "HotDogStand": {
        backgroundColor: "#000000",
        fillColor: "#FF0000",
        fillColor2: "#FFFF00",
        blendColor: "#FFFFFF",
        buzzColor: "#990000",
        quietColor: "#330000"
    },
    "PeaSoupLcd": {
        backgroundColor: "#0F380F",
        fillColor: "#306230",
        fillColor2: "#8BAC0F",
        blendColor: "#9BBC0F",
        buzzColor: "#333333",
        quietColor: "#000000"
    },
    "Grayscale": {
        backgroundColor: "#AAAAAA",
        fillColor: "#000000",
        fillColor2: "#FFFFFF",
        blendColor: "#666666",
        buzzColor: "#666666",
        quietColor: "#000000"
    },
    "CGA0": {
        backgroundColor: "#000000",
        fillColor: "#00FF00",
        fillColor2: "#FF0000",
        blendColor: "#FFFF00",
        buzzColor: "#999900",
        quietColor: "#333300"
    },
    "CGA1": {
        backgroundColor: "#000000",
        fillColor: "#FF00FF",
        fillColor2: "#00FFFF",
        blendColor: "#FFFFFF",
        buzzColor: "#990099",
        quietColor: "#330033"
    }
}