qwebirc.ui.HILIGHT_NONE = 0;
qwebirc.ui.HILIGHT_ACTIVITY = 1;
qwebirc.ui.HILIGHT_SPEECH = 2;
qwebirc.ui.HILIGHT_US = 3;

qwebirc.ui.WINDOW_LASTLINE = qwebirc.ui.WINDOW_QUERY | qwebirc.ui.WINDOW_MESSAGES | qwebirc.ui.WINDOW_CHANNEL | qwebirc.ui.WINDOW_STATUS;

qwebirc.ui.Window = new Class({
  Implements: [Events],
  initialize: function(session, type, name, identifier) {
    this.session = session;
    this.type = type;
    this.name = name;
    this.active = false;
    this.identifier = identifier;
    this.hilighted = qwebirc.ui.HILIGHT_NONE;
    this.scrolltimer = null;
    this.commandhistory = ui.commandhistory;
    this.scrolleddown = true;
    this.scrollpos = null;
    this.lastNickHash = {};
    this.lastSelected = null;
    this.subWindow = null;
    this.closed = false;

    if(this.type & qwebirc.ui.WINDOW_LASTLINE) {
      this.lastPositionLine = new Element("hr");
      this.lastPositionLine.addClass("lastpos");
      this.lastPositionLineInserted = false;
    }
  },
  updateTopic: function(topic, element)  {
    qwebirc.ui.Colourise(this.session, "[" + topic + "]", element);
  },
  subEvent: function(event) {
    if(this.subWindow)
      this.subWindow.fireEvent(event);
  },
  setSubWindow: function(window) {
    this.subWindow = window;
  },
  select: function() {
    if(this.lastPositionLineInserted && !conf.ui.lastpos_line) {
      this.lines.removeChild(this.lastPositionLine);
      this.lastPositionLineInserted = false;
    }

    this.active = true;
    ui.__setActiveWindow(this);
    if(this.hilighted)
      this.setHilighted(qwebirc.ui.HILIGHT_NONE);

    this.subEvent("select");
    this.resetScrollPos();
    this.lastSelected = new Date();
  },
  deselect: function() {
    this.subEvent("deselect");

    this.setScrollPos();
    if(this.scrolltimer) {
      window.clearTimeout(this.scrolltimer);
      this.scrolltimer = null;
    }

    if(this.type & qwebirc.ui.WINDOW_LASTLINE)
      this.replaceLastPositionLine();

    this.active = false;
  },
  resetScrollPos: function() {
    if(this.scrolleddown) {
      this.scrollToBottom();
    } else if(this.scrollpos) {
      this.getScrollParent().scrollTo(this.scrollpos.x, this.scrollpos.y);
    }
  },
  setScrollPos: function() {
    if(!ui.singleWindow) {
      this.scrolleddown = this.scrolledDown();
      this.scrollpos = this.lines.getScroll();
    }
  },
  addLine: function(type, line, colour, element) {
    var hilight = qwebirc.ui.HILIGHT_NONE;
    var lhilight = false;

    if(type) {
      hilight = qwebirc.ui.HILIGHT_ACTIVITY;

      if(type.match(/(NOTICE|ACTION|MSG)$/)) {
        if(this.type == qwebirc.ui.WINDOW_QUERY || this.type == qwebirc.ui.WINDOW_MESSAGES) {
          if(type.match(/^OUR/) || type.match(/NOTICE$/)) {
            hilight = qwebirc.ui.HILIGHT_ACTIVITY;
          } else {
            hilight = qwebirc.ui.HILIGHT_US;
            ui.beep();
            ui.flash();
          }
        }
        if(!type.match(/^OUR/) && this.session.irc.hilightController.match(line["m"])) {
          lhilight = true;
          hilight = qwebirc.ui.HILIGHT_US;
          ui.beep();
          ui.flash();
        } else if(hilight != qwebirc.ui.HILIGHT_US) {
          hilight = qwebirc.ui.HILIGHT_SPEECH;
        }
      }
    }

    if(!this.active && (hilight != qwebirc.ui.HILIGHT_NONE))
      this.setHilighted(hilight);

    if(type)
      line = ui.theme.message(type, line, lhilight);

    qwebirc.ui.Colourise(this.session, qwebirc.irc.IRCTimestamp(new Date()) + " " + line, element);
    this.scrollAdd(element);
  },
  errorMessage: function(message) {
    this.addLine("", message, "warncolour");
  },
  infoMessage: function(message) {
    this.addLine("", message, "infocolour");
  },
  setHilighted: function(state) {
    if(state == qwebirc.ui.HILIGHT_NONE || state >= this.hilighted)
      this.hilighted = state;
  },
  scrolledDown: function() {
    if(this.scrolltimer)
      return true;

    var parent = this.lines;

    var prev = parent.getScroll();
    var prevbottom = parent.getScrollSize().y;
    var prevheight = parent.clientHeight;

    /*
     * fixes an IE bug: the scrollheight is less than the actual height
     * when the div isn't full
     */
    if(prevbottom < prevheight)
      prevbottom = prevheight;

    return prev.y + prevheight == prevbottom;
  },
  getScrollParent: function() {
    var scrollparent = this.lines;

    if(this.scroller)
      scrollparent = this.scroller;
    return scrollparent;
  },
  scrollToBottom: function() {
    if(this.type == qwebirc.ui.WINDOW_CUSTOM)
      return;

    var parent = this.lines;
    var scrollparent = this.getScrollParent();

    scrollparent.scrollTo(parent.getScroll().x, parent.getScrollSize().y);
  },
  scrollAdd: function(element) {
    var parent = this.lines;

    /* scroll in bursts, else the browser gets really slow */
    if(element) {
      var sd = this.scrolledDown();
      parent.appendChild(element);
      if(sd) {
        if(this.scrolltimer)
          window.clearTimeout(this.scrolltimer);
        this.scrolltimer = this.scrollAdd.delay(50, this, [null]);
      }
    } else {
      this.scrollToBottom();
      this.scrolltimer = null;
    }
  },
  updateNickList: function(nicks) {
    var nickHash = {}, present = {};
    var added = [];
    var lnh = this.lastNickHash;

    for(var i=0;i<nicks.length;i++)
      present[nicks[i]] = 1;

    for(var k in lnh)
      if(!present[k])
        this.nickListRemove(k, lnh[k]);

    for(var i=0;i<nicks.length;i++) {
      var n = nicks[i];
      var l = lnh[n];
      if(!l) {
        l = this.nickListAdd(n, i);
        if(!l)
          l = 1;
      }
      nickHash[n] = l;
    }

    this.lastNickHash = nickHash;
  },
  nickListAdd: function(nick, position) {
  },
  nickListRemove: function(nick, stored) {
  },
  historyExec: function(line) {
    this.commandhistory.addLine(line);
    this.session.irc.exec(line);
  },
  focusChange: function(newValue) {
    if(newValue == true || !(this.type & qwebirc.ui.WINDOW_LASTLINE))
      return;

    this.replaceLastPositionLine();
  },
  replaceLastPositionLine: function() {
    if(conf.ui.lastpos_line) {
      if(!this.lastPositionLineInserted) {
        this.scrollAdd(this.lastPositionLine);
      } else if(this.lines.lastChild != this.lastPositionLine) {
        try {
          this.lines.removeChild(this.lastPositionLine);
        } catch(e) {
          /* IGNORE, /clear removes lastPositionLine from the dom without resetting it. */
        }
        this.scrollAdd(this.lastPositionLine);
      }
    } else {
      if(this.lastPositionLineInserted)
        this.lines.removeChild(this.lastPositionLine);
    }

    this.lastPositionLineInserted = conf.ui.lastpos_line;
  }
});
