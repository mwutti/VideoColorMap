var inputForm = $('#inputForm');
var colorMap = $('#colorMap');
var dominantColorMap = $('#dominantColorMap');
var inputVideo = document.querySelector('input');
var videoTag = document.querySelector('video');

var videoWidth;
var videoHeight;
var targetHeight = 200;

var URL = window.URL || window.webkitURL;
var interval = 20; // alle 10 Sekunden wird ein Frame aus dem Video entnommen
var duration; // Länge des Videos

// Eine Map die in der die einzelnen Frames {dominantColor, {canvas}} gespeichert werden.
var imageMap = {};
var nrOfDominantColors = 1;
var useColorThief = false;


/**
 *  Nachdem ein Video ausgewählt wurde, wird dem <video/>-Element das Video zugewiesen;
 *  Zu beachten ist hierbei, dass die URL zum Abspielen des Videos eine lokale URL ist
 *  und somit muss man mittels Web-API  URL.createObjectURL() eine Url erzeugen die auf die lokale Datei zeigt.
 *  (Sonst könnte man via Script jede beliebige Datei im Dateisystem des Clients laden).
 */
inputForm.on('submit', function(event) {
    event.preventDefault();
    debugger;
    //todo Number of dominantColors and colorThief
    nrOfDominantColors = 5;
    useColorThief = false;

    var videoFile = inputVideo.files[0];
    var videoType = videoFile.type;
    var canPlay = videoTag.canPlayType(videoType);


    if (canPlay === '') {
        alert('Unable to play Video. Supported file formats are: MP4, OGG, MebM');
        return;
    } else {
        videoTag.src = URL.createObjectURL(videoFile);

        var intervalID = setInterval(function(){
            if (videoTag.readyState > 0) {
                clearInterval(intervalID);
                videoWidth = videoTag.videoWidth;
                videoHeight = videoTag.videoHeight;

                //Mit der Erzeugung der ColorMap beginnen
                doMagicStuff();
            }
        }, 200);
    }
});

function doMagicStuff() {
    duration = parseInt(videoTag.duration);
    var frameAt = interval;

    /**
     * Jedes mal wenn sich ein Frame im Video ändert, wird die Bearbeitung ausgeführt
     **/
    videoTag.addEventListener('seeked', function () {
        var imageCanvas = document.createElement('canvas');
        var context = imageCanvas.getContext('2d');
        /**
         * Zuerst wird ein Canvas Element erstellt, das die Originalgröße des Videos hat und  auf dessen Basis
         * die dominante Farbe berechnet wird
         */
        imageCanvas.height = videoHeight;
        imageCanvas.width = videoWidth;
        imageCanvas.id = 'image' + frameAt;

        context.drawImage(videoTag, 0, 0);

        /**
         * Entweder wird auf Basis einer Farbpalette von ColorThief die DominanteFarbe berechnet
         */
        if (useColorThief) {
            var colorThief = new ColorThief();

            var colorPalleteFromColorThief = colorThief.getPalette(imageCanvas, nrOfDominantColors);
            var colorPalleteForDominantColor = [];
            $.each(colorPalleteFromColorThief, function(index, value) {
                var colorHex = rgbToHex(value[0], value[1], value[2]);
                colorPalleteForDominantColor.push(colorHex);
            });

            dominantColor = getDominantColorFromColorPalette(imageCanvas, colorPalleteForDominantColor)[0];
        } else if (nrOfDominantColors > 1){
            /**
             * Oder es wird ein erweiterter Algorithmus verwendet
             */
            var dominantColor = getDominantColor(imageCanvas, nrOfDominantColors);

            var colorPalette = [];
            $.each(dominantColor, function() {
                colorPalette.push(this[0]);
            });

            dominantColor = getDominantColorFromColorPalette(imageCanvas, colorPalette)[0];
        } else {
            /**
             * Oder der einfache Algorithmus
             */
            var dominantColor = getDominantColor(imageCanvas, nrOfDominantColors);
        }

        if (imageMap[dominantColor] == undefined) {
            imageMap[dominantColor] = [];
        }
        imageMap[dominantColor].push(imageCanvas);

        //Nächster Frame ist dran
        frameAt = frameAt + interval;

        if (frameAt <= duration) {
            videoTag.currentTime = frameAt;
        } else {
            //Frames skallieren
            $.each(imageMap, function() {
                var context = this[0].getContext('2d');
                context.save();
                context.scale(0.5, 0.5);
                context.restore();
            });

            //Gibt das Zeichen, das alle dominanten Farben und Frames vorhanden sind
            colorMap.trigger("ready");
        }
    });

    //Initialer Anstoß der Erzeugung zur ColorMap
    videoTag.currentTime = frameAt;
}

colorMap.on('ready', function() {
    //keys sortieren
    var keys = [];

    $.each(imageMap, function(key, value) {
        keys.push(key);
    });

    keys.sort();

    //Canvas Elemente in richtiger Reihenfolge in die Color Map werfen
    $.each(keys, function(index, value) {
        $.each(imageMap[value], function() {
            colorMap.append(this);
//                appendDominantColor(value);
        })
    })

    $.each(keys, function(index, value) {
        $.each(imageMap[value], function() {
//                colorMap.append(this);
            appendDominantColor(value);
        })
    })

});

function getDominantColor(canvas, nrOfColors) {
    var dictionary = {};
    var context = canvas.getContext('2d');
    var imageData = context.getImageData(0, 0, videoWidth, videoHeight).data;

    //Downsampling jeder 10te pixel horizontal
    for (var i = 0; i < imageData.length; i+=40) {
        // Jeder 10te pixel vertikal
        if (i % (videoWidth * 4) == 0) {
            //Schutz vor Überlauf
            if (i + videoWidth * 40 < imageData.length) {
                i = i + videoWidth * 40;
            }
        }
        var red = imageData[i];
        var green = imageData[i+1];
        var blue = imageData[i+2];

        //integer rep
//            var rgb = (red << 24) + (green << 16) + (blue << 8) + (alpha);
        var rgb = rgbToHex(componentToHex(red), componentToHex(green), componentToHex(blue));

        if (dictionary[rgb] == undefined) {
            dictionary[rgb] = 1;
        } else {
            dictionary[rgb] = dictionary[rgb] + 1;
        }
    }

    //Nur dominanteste Farbe zurückgeben
    if (nrOfColors == undefined || nrOfColors == 1) {
        var result;
        var max = 0;

        $.each(dictionary, function(key, value) {
            if (value > max) {
                max = value;
                result = key;
            }
        });
        return result;
    } else {
        //Mehrere Dominante Farben zurückgeben, dazu werden zuerst die Counter sortiert
        var sortable = [];

        for (var rgb in dictionary) {
            sortable.push([rgb, dictionary[rgb]]);
        }

        var sortedByValue = sortable.sort(function(a, b) {
            return a[1] - b[1]
        });

        //und danach die n..(nrOfColors) dominantesten Farben zurückgegeben
        return sortedByValue.slice(Math.max(sortedByValue.length - nrOfColors, 1));
    }
}

function getDominantColorFromColorPalette(canvas, colorPalette) {
    //ZielMap
    var map = {};
    $.each(colorPalette, function(){
        map[this] = 0;
    });

    var context = canvas.getContext('2d');
    var imageData = context.getImageData(0, 0, videoWidth, videoHeight).data;

    //Mit Downsampling
    for (var i = 0; i < imageData.length; i+=40) {
        if (i % (videoWidth * 4) == 0) {
            //Schutz vor Überlauf
            if (i + videoWidth * 40 < imageData.length) {
                i = i + videoWidth * 40;
            }
        }
        var distances = distancesToColorPalette(imageData, colorPalette, i);

        var minimumDistance = 99999999999999999999;
        var minimumDistanceIndex;
        $.each(distances, function(index, value) {
            if (value < minimumDistance) {
                minimumDistanceIndex = index;
            }
        });

        map[minimumDistanceIndex] = map[minimumDistanceIndex] + 1;
    }

    var sortable = [];

    for (var hex in map) {
        sortable.push([hex, map[hex]]);
    }

    var sortedByValue = sortable.sort(function(a, b) {
        return a[1] - b[1]
    });

    return sortedByValue[sortedByValue.length - 1];
}

function distancesToColorPalette(imageData, colorPalette, i) {
    var pixelRed = imageData[i];
    var pixelGreen = imageData[i+1];
    var pixelBlue = imageData[i+2];
    var distances = [];

    $.each(colorPalette, function() {
        //Euklidischee Abstand im Raum

        var hexToRgb = rgbFromHex('#' + this);
        var distance = Math.sqrt(Math.pow(pixelRed - hexToRgb.red,2) + Math.pow(pixelGreen - hexToRgb.green, 2) + Math.pow(pixelBlue - hexToRgb.blue,2));
        distances.push(distance);
    });

    return distances;
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function rgbFromHex(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        red: parseInt(result[1], 16),
        green: parseInt(result[2], 16),
        blue: parseInt(result[3], 16)
    } : null;
}


function appendDominantColor(dominantColor) {
    var colorcanvas = document.createElement('canvas');
    colorcanvas.height = videoHeight;
    colorcanvas.width = videoWidth;

    var context2d = colorcanvas.getContext('2d');
    context2d.fillStyle = '#' + dominantColor;
    context2d.fillRect(0,0,videoWidth,videoHeight);
    dominantColorMap.append(colorcanvas);
}