(function(root, factory) {
    if (typeof define === "function" && define.amd) {
        define([ "jquery" ], factory);
    } else if (typeof exports === "object") {
        factory(require("jquery"));
    } else {
        if (root.jQuery) {
            factory(root.jQuery);
        } else {
            factory(root.Zepto);
        }
    }
})(this, function($, undefined) {
    $.fn.audioPlayer = function(options) {
        var name = "audioPlayer";
        var isMethodCall = typeof options === "string", args = Array.prototype.slice.call(arguments, 1), returnValue = this;
        options = !isMethodCall && args.length ? $.extend.apply(null, [ true, options ].concat(args)) :options;
        if (isMethodCall && options.charAt(0) === "_") {
            return returnValue;
        }
        if (isMethodCall) {
            this.each(function() {
                var instance = $(this).data(name), methodValue = instance && $.isFunction(instance[options]) ? instance[options].apply(instance, args) :instance;
                if (methodValue !== instance && methodValue !== undefined) {
                    returnValue = methodValue;
                    return false;
                }
            });
        } else {
            this.each(function() {
                var instance = $(this).data(name);
                if (instance) {
                    instance.option(options || {});
                } else {
                    $(this).data(name, new $.audioPlayer(options, this));
                }
            });
        }
        return returnValue;
    };
    
    $.audioPlayer = function(options, element) {
        if (arguments.length) {
            this.element = $(element);
            this.options = $.extend(true, {}, this.options, options);
            var self = this;
            this.element.bind("remove.audioPlayer", function() {
                self.destroy();
            });
            this._init();
        }
    };

    $.audioPlayer.event = {};
    $.each([ "ready", "setmedia", "click", "loadstart", "play", "pause", "loadedmetadata", "loadeddata", "playing", "timeupdate", "ended" ], function() {
        $.audioPlayer.event[this] = "audioPlayer_" + this;
    });
    $.audioPlayer.htmlEvent = [ "loadstart", "loadedmetadata" ];

    $.audioPlayer.browser = {};
    $.audioPlayer.platform = {};

    $.audioPlayer.prototype = {
        count:0,
        options:{
            solution:"html",
            supplied:"mp3",
            preload:"metadata",
            idPrefix:"ap",
            noConflict:"jQuery"
        },
        optionsAudio:{
            size:{
                width:"0px",
                height:"0px",
                cssClass:""
            },
            sizeFull:{
                width:"0px",
                height:"0px",
                cssClass:""
            }
        },
        instances:{},
        status:{
            src:"",
            media:{},
            paused:true,
            format:{},
            formatType:"",
            waitForLoad:true,
            srcSet:false,
            currentTime:0,
            duration:0,
            readyState:0,
            networkState:0,
            ended:0
        },
        internal:{
            ready:false
        },
        solution:{
            html:true
        },
        format:{
            mp3:{
                codec:"audio/mpeg",
                media:"audio"
            },
            m4a:{
                codec:'audio/mp4; codecs="mp4a.40.2"',
                media:"audio"
            }
        },
        _init:function() {
            var self = this;
            this.element.empty();
            this.status = $.extend({}, this.status);
            this.internal = $.extend({}, this.internal);
            this.internal.cmdsIgnored = $.audioPlayer.platform.ipad || $.audioPlayer.platform.iphone || $.audioPlayer.platform.ipod;
            this.internal.domNode = this.element.get(0);

            this.formats = [];
            this.solutions = [];
            this.require = {};
            this.htmlElement = {};
            this.html = {};
            this.html.audio = {};
            $.each(this.options.supplied.toLowerCase().split(","), function(index1, value1) {
                var format = value1.replace(/^\s+|\s+$/g, "");
                if (self.format[format]) {
                    var dupFound = false;
                    $.each(self.formats, function(index2, value2) {
                        if (format === value2) {
                            dupFound = true;
                            return false;
                        }
                    });
                    if (!dupFound) {
                        self.formats.push(format);
                    }
                }
            });
            $.each(this.options.solution.toLowerCase().split(","), function(index1, value1) {
                var solution = value1.replace(/^\s+|\s+$/g, "");
                if (self.solution[solution]) {
                    var dupFound = false;
                    $.each(self.solutions, function(index2, value2) {
                        if (solution === value2) {
                            dupFound = true;
                            return false;
                        }
                    });
                    if (!dupFound) {
                        self.solutions.push(solution);
                    }
                }
            });
            this.internal.instance = "ap_" + this.count;
            this.instances[this.internal.instance] = this.element;
            if (!this.element.attr("id")) {
                this.element.attr("id", this.options.idPrefix + "_audioplayer_" + this.count);
            }
            this.internal.self = $.extend({}, {
                id:this.element.attr("id"),
                jq:this.element
            });
            this.internal.audio = $.extend({}, {
                id:this.options.idPrefix + "_audio_" + this.count,
                jq:undefined
            });
            $.each($.audioPlayer.event, function(eventName, eventType) {
                if (self.options[eventName] !== undefined) {
                    self.element.bind(eventType + ".audioPlayer", self.options[eventName]);
                    self.options[eventName] = undefined;
                }
            });
            this.require.audio = false;
            $.each(this.formats, function(priority, format) {
                self.require[self.format[format].media] = true;
            });
            this.options = $.extend(true, {}, this.optionsAudio, this.options);
            this.html.audio.available = false;
            if (this.require.audio) {
                this.htmlElement.audio = document.createElement("audio");
                this.htmlElement.audio.id = this.internal.audio.id;
                this.html.audio.available = !!this.htmlElement.audio.canPlayType;
            }
            this.html.canPlay = {};
            $.each(this.formats, function(priority, format) {
                self.html.canPlay[format] = self.html[self.format[format].media].available && "" !== self.htmlElement[self.format[format].media].canPlayType(self.format[format].codec);
            });
            this.html.desired = false;
            $.each(this.solutions, function(solutionPriority, solution) {
                if (solutionPriority === 0) {
                    self[solution].desired = true;
                } else {
                    var audioCanPlay = false;
                    $.each(self.formats, function(formatPriority, format) {
                        if (self[self.solutions[0]].canPlay[format]) {
                            audioCanPlay = true;
                        }
                    });
                    self[solution].desired = self.require.audio && !audioCanPlay;
                }
            });
            this.html.support = {};
            $.each(this.formats, function(priority, format) {
                self.html.support[format] = self.html.canPlay[format] && self.html.desired;
            });
            this.html.used = false;
            $.each(this.solutions, function(solutionPriority, solution) {
                $.each(self.formats, function(formatPriority, format) {
                    if (self[solution].support[format]) {
                        self[solution].used = true;
                        return false;
                    }
                });
            });
            if (this.html.used) {
                if (this.html.audio.available) {
                    this._addHtmlEventListeners(this.htmlElement.audio, this.html.audio);
                    this.element.append(this.htmlElement.audio);
                    this.internal.audio.jq = $("#" + this.internal.audio.id);
                }
            }
            if (this.html.used) {
                setTimeout(function() {
                    self.internal.ready = true;
                    self._trigger($.audioPlayer.event.ready);
                }, 100);
            }
            $.audioPlayer.prototype.count++;
        },
        destroy:function() {
            this.clearMedia();

            this.element.removeData("audioPlayer");
            this.element.unbind(".audioPlayer");
            this.element.empty();
            delete this.instances[this.internal.instance];
        },
        destroyRemoved:function() {
            var self = this;
            $.each(this.instances, function(i, element) {
                if (self.element !== element) {
                    if (!element.data("audioPlayer")) {
                        element.audioPlayer("destroy");
                        delete self.instances[i];
                    }
                }
            });
        },
        _addHtmlEventListeners:function(mediaElement, entity) {
            var self = this;
            mediaElement.preload = this.options.preload;
            mediaElement.addEventListener("loadeddata", function() {
                if (entity.gate) {
                    self._trigger($.audioPlayer.event.loadeddata);
                }
            }, false);
            mediaElement.addEventListener("play", function() {
                if (entity.gate) {
                    self._trigger($.audioPlayer.event.play);
                }
            }, false);
            mediaElement.addEventListener("playing", function() {
                if (entity.gate) {
                    self._trigger($.audioPlayer.event.playing);
                }
            }, false);
            mediaElement.addEventListener("pause", function() {
                if (entity.gate) {
                    self._trigger($.audioPlayer.event.pause);
                }
            }, false);
            mediaElement.addEventListener("ended", function() {
                if (entity.gate) {
                    if (!$.audioPlayer.browser.webkit) {
                        self.htmlElement.media.currentTime = 0;
                    }
                    self.htmlElement.media.pause();
                    self._trigger($.audioPlayer.event.ended);
                }
            }, false);
            $.each($.audioPlayer.htmlEvent, function(i, eventType) {
                mediaElement.addEventListener(this, function() {
                    if (entity.gate) {
                        self._trigger($.audioPlayer.event[eventType]);
                    }
                }, false);
            });
        },
        _trigger:function(eventType, error, warning) {
            var event = $.Event(eventType);
            event.audioPlayer = {};
            event.audioPlayer.options = $.extend(true, {}, this.options);
            event.audioPlayer.status = $.extend(true, {}, this.status);
            event.audioPlayer.html = $.extend(true, {}, this.html);
            if (error) {
                event.audioPlayer.error = $.extend({}, error);
            }
            if (warning) {
                event.audioPlayer.warning = $.extend({}, warning);
            }
            this.element.trigger(event);
        },
        _escapeHtml:function(s) {
            return s.split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;");
        },
        _qualifyURL:function(url) {
            var el = document.createElement("div");
            el.innerHTML = '<a href="' + this._escapeHtml(url) + '">x</a>';
            return el.firstChild.href;
        },
        _absoluteMediaUrls:function(media) {
            var self = this;
            $.each(media, function(type, url) {
                if (url && self.format[type] && url.substr(0, 5) !== "data:") {
                    media[type] = self._qualifyURL(url);
                }
            });
            return media;
        },
        setMedia:function(media) {
            var self = this, supported = false;
            media = this._absoluteMediaUrls(media);
            $.each(this.formats, function(formatPriority, format) {
                $.each(self.solutions, function(solutionPriority, solution) {
                    if (self[solution].support[format] && self._validString(media[format])) {
                        var isHtml = solution === "html";
                        if (isHtml) {
                            self.html.audio.gate = true;
                            self._html_setAudio(media);
                            self.html.active = true;
                        } else {}
                        supported = true;
                        return false;
                    }
                });
                if (supported) {
                    return false;
                }
            });
            if (supported) {
                this.status.srcSet = true;
                this.status.media = $.extend({}, media);
                this._trigger($.audioPlayer.event.setmedia);
            }
        },
        clearMedia:function() {
            this._resetMedia();
            if (this.html.active) {
                this._html_clearMedia();
            }
        },
        load:function() {
            if (this.status.srcSet) {
                if (this.html.active) {
                    this._html_load();
                }
            }
        },
        play:function(time) {
            var guiAction = typeof time === "object";
            if (guiAction && !this.status.paused) {
                this.pause(time);
            } else {
                time = typeof time === "number" ? time :NaN;
                if (this.status.srcSet) {
                    if (this.html.active) {
                        this._html_play(time);
                    }
                }
            }
        },
        pause:function(time) {
            time = typeof time === "number" ? time :NaN;
            if (this.status.srcSet) {
                if (this.html.active) {
                    this._html_pause(time);
                }
            }
        },
        tellOthers:function(command, conditions) {
            var self = this, hasConditions = typeof conditions === "function", args = Array.prototype.slice.call(arguments);
            if (typeof command !== "string") {
                return;
            }
            if (hasConditions) {
                args.splice(1, 1);
            }
            $.audioPlayer.prototype.destroyRemoved();
            $.each(this.instances, function() {
                if (self.element !== this) {
                    if (!hasConditions || conditions.call(this.data("audioPlayer"), self)) {
                        this.audioPlayer.apply(this, args);
                    }
                }
            });
        },
        pauseOthers:function(time) {
            this.tellOthers("pause", function() {
                return this.status.srcSet;
            }, time);
        },
        stop:function() {
            if (this.status.srcSet) {
                if (this.html.active) {
                    this._html_pause(0);
                }
            }
        },
        option:function(key, value) {
            var options = key;
            if (arguments.length === 0) {
                return $.extend(true, {}, this.options);
            }
            if (typeof key === "string") {
                var keys = key.split(".");
                if (value === undefined) {
                    var opt = $.extend(true, {}, this.options);
                    for (var i = 0; i < keys.length; i++) {
                        if (opt[keys[i]] !== undefined) {
                            opt = opt[keys[i]];
                        }
                    }
                    return opt;
                }
                options = {};
                var opts = options;
                for (var j = 0; j < keys.length; j++) {
                    if (j < keys.length - 1) {
                        opts[keys[j]] = {};
                        opts = opts[keys[j]];
                    } else {
                        opts[keys[j]] = value;
                    }
                }
            }
            return this;
        },
        _html_initMedia:function(media) {
            var $media = $(this.htmlElement.media).empty();
            $.each(media.track || [], function(i, v) {
                var track = document.createElement("track");
                track.setAttribute("kind", v.kind ? v.kind :"");
                track.setAttribute("src", v.src ? v.src :"");
                track.setAttribute("srclang", v.srclang ? v.srclang :"");
                track.setAttribute("label", v.label ? v.label :"");
                if (v.def) {
                    track.setAttribute("default", v.def);
                }
                $media.append(track);
            });
            this.htmlElement.media.src = this.status.src;
            if (this.options.preload !== "none") {
                this._html_load();
            }
            this._trigger($.audioPlayer.event.timeupdate);
        },
        _html_setFormat:function(media) {
            var self = this;
            $.each(this.formats, function(priority, format) {
                if (self.html.support[format] && media[format]) {
                    self.status.src = media[format];
                    self.status.format[format] = true;
                    self.status.formatType = format;
                    return false;
                }
            });
        },
        _html_setAudio:function(media) {
            this._html_setFormat(media);
            this.htmlElement.media = this.htmlElement.audio;
            this._html_initMedia(media);
        },
        _html_clearMedia:function() {
            if (this.htmlElement.media) {
                this.htmlElement.media.src = "about:blank";
                this.htmlElement.media.load();
            }
        },
        _html_load:function() {
            if (this.status.waitForLoad) {
                this.status.waitForLoad = false;
                this.htmlElement.media.load();
            }
            clearTimeout(this.internal.htmlDlyCmdId);
        },
        _html_play:function(time) {
            var self = this, media = this.htmlElement.media;
            this._html_load();
            if (!isNaN(time)) {
                if (this.internal.cmdsIgnored) {
                    media.play();
                }
                try {
                    if (!media.seekable || typeof media.seekable === "object" && media.seekable.length > 0) {
                        media.currentTime = time;
                        media.play();
                    } else {
                        throw 1;
                    }
                } catch (err) {
                    this.internal.htmlDlyCmdId = setTimeout(function() {
                        self.play(time);
                    }, 250);
                    return;
                }
            } else {
                media.play();
            }
        },
        _html_pause:function(time) {
            var self = this, media = this.htmlElement.media;
            if (time > 0) {
                this._html_load();
            } else {
                clearTimeout(this.internal.htmlDlyCmdId);
            }
            media.pause();
            if (!isNaN(time)) {
                try {
                    if (!media.seekable || typeof media.seekable === "object" && media.seekable.length > 0) {
                        media.currentTime = time;
                    } else {
                        throw 1;
                    }
                } catch (err) {
                    this.internal.htmlDlyCmdId = setTimeout(function() {
                        self.pause(time);
                    }, 250);
                    return;
                }
            }
        },
        _validString:function(url) {
            return url && typeof url === "string";
        }
    };
});