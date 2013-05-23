window.WEB_SOCKET_SWF_LOCATION = "WebSocketMain.swf";
window.WEB_SOCKET_DEBUG = true;

if (!window.localStorage) {
  window.localStorage = {
    getItem: function (sKey) {
      if (!sKey || !this.hasOwnProperty(sKey)) { return null; }
      return unescape(document.cookie.replace(new RegExp("(?:^|.*;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*"), "$1"));
    },
    key: function (nKeyId) {
      return unescape(document.cookie.replace(/\s*\=(?:.(?!;))*$/, "").split(/\s*\=(?:[^;](?!;))*[^;]?;\s*/)[nKeyId]);
    },
    setItem: function (sKey, sValue) {
      if(!sKey) { return; }
      document.cookie = escape(sKey) + "=" + escape(sValue) + "; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/";
      this.length = document.cookie.match(/\=/g).length;
    },
    length: 0,
    removeItem: function (sKey) {
      if (!sKey || !this.hasOwnProperty(sKey)) { return; }
      document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      this.length--;
    },
    hasOwnProperty: function (sKey) {
      return (new RegExp("(?:^|;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
    }
  };
  window.localStorage.length = (document.cookie.match(/\=/g) || window.localStorage).length;
}

qwebirc.irc.IRCConnection = new Class({
  Implements: [Events, Options],
  options: {
    initialNickname: "ircconnX",
    errorAlert: true,
    serverPassword: null
  },
  initialize: function(options) {
    this.setOptions(options);
    
    this.initialNickname = this.options.initialNickname;
    
    this.counter = 0;
    this.disconnected = false;
    this.csent = false;
    this.sessionid = '1jd93jf983jf983j8qq';
  },
  send: function(data, synchronous) {
    data = data.replace("\r","").replace("\n","");
    ////console.log(">: "+data);
    var hex = '';
    for(var i=0;i<data.length;i++) {
        hex += ''+data.charCodeAt(i).toString(16);
    }
    //console.log("H>:"+hex);
    this.ws.send(data);
    return true;
  },
  connect: function() {
    if( WebSocket == null ) {
      alert("WebSocket not supported by your browser, and no compatible flash version found");
      return;
    }
    this.ws = new WebSocket("ws://irc.rbx.fr.euirc.net:8080/irc");
    this.ws.onopen = function() {
	if(!(cookie = window.localStorage.getItem("euIRCidentCookie")) || cookie.charAt(0) == 'a') {
		var base = 'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		var cookie = 'qwb';
		for(var i=0;i<6;i++)
			cookie += base.charAt(Math.floor(Math.random()*base.length));
		window.localStorage.setItem("euIRCidentCookie", cookie);
	}
	if($defined(this.options.serverPassword))
          this.ws.send("PASS "+this.options.serverPassword);
	this.ws.send("NICK "+this.initialNickname);
	this.ws.send("cap req multi-prefix");
	this.ws.send("cap end");
	this.ws.send("USER "+cookie+" * * *");
    }.bind(this);
    this.ws.onmessage = function(e) {
      var lines = e.data.split("\n");
      for( var k=0; k<lines.length-1; k++ ) {
	lines[k] = lines[k].replace("\r", "");
	//console.log("<: "+lines[k]);
	var msg = ["c", "", "irc.rbx.fr.euirc.net"]; //FIXME
        if(lines[k].charAt(0) == ':') {
          msg[2] = lines[k].split(" ", 1)[0].substring(1);
	  lines[k] = lines[k].substring(lines[k].indexOf(" ")+1);
        }
	msg[1] = lines[k].split(" ", 1)[0];
	lines[k] = lines[k].substring(lines[k].indexOf(" ")+1);
	var token = [];
	var i = 0
	while(lines[k].length > 0) {
		i++;
		if(lines[k].charAt(0) == ':') {
			token[token.length] = lines[k].substring(1);
			break;
		}
		token[token.length] = lines[k].split(" ",1)[0];
		if(lines[k].indexOf(" ") < 0)
			break;
		lines[k] = lines[k].substring(lines[k].indexOf(" ")+1);
	}
	//console.log("i:"+i);
	msg[3] = token;
	this.fireEvent("recv", [msg]);
      }	
      if(!this.csent) {
        this.fireEvent("recv", [["connect"]]);
        this.csent = true;
      }
    }.bind(this);
    this.ws.onclose = function() {
      if(this.disconnected) return;
      this.fireEvent("error", "Connection to websocket server lost");
      this.fireEvent("recv", ["disconnect", ["Conection to websocket server lost"]]);
      if(this.options.errorAlert)
        alert("Connection to websocket server lost");
      this.disconnected = true; 
    }.bind(this);
    this.ws.onerror = function() {
      if(this.disconnected) return;
      this.fireEvent("error", "couldn't connect to websocket server");
      this.fireEvent("recv", ["disconnect", ["Conection to websocket server lost"]]);
      if(this.options.errorAlert)
        alert("Connection to websocket server failed");
      this.disconnected = true; 
    }.bind(this);
      
  },
  disconnect: function() {
    this.ws.close();
  }
});
