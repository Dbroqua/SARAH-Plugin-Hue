var request = require('request');
var winston = require('winston');

 
exports.action = function(data, callback, config, SARAH){

  var config = config.modules.hue;
  if (!config.ip || !config.username){
    return callback('tts', 'Configuration HUE invalide');
  }
  
  // Create a new username  
  if (data.user){
    checkUser(config);
    return callback({});
  }
  
  // Fix on/off
  if (data.on === "true")  data.on = true;
  if (data.on === "false") data.on = false;
  
  // Convert RGB to HSL + XY
  rgbToHSLAndXY(data.rgb, data);
  
  // Handle groups
  if (data.group){
    setGroup(data.light, data, config);
    return callback({});
  }
  
  // Handle lights
  if (data.light){
    setLight(data.light, data, config);
    return callback({});
  }
  
  // Handle all lights specified in properties
  if (config.alllights){
    config.alllights.split(',').forEach(function(light){
      if (data.lights || rgbToHSLAndXY(data['rgb'+light], data)){
        setLight(light, data, config);
      }
    });
  }
  
  callback({}); 
}

exports.init = function(SARAH){
  checkUser(SARAH.ConfigManager.getConfig().modules.hue);
}

var validUser = false;
exports.isValidUser = function(){
  return validUser;
}

// ------------------------------------------
//  LIGHTS
// ------------------------------------------

var setLight = function(id, body, config, callback){
  put('lights/'+id+'/state', body, config, callback);
}

var setGroup = function(id, body, config, callback){
  put('groups/'+id+'/action', body, config, callback);
}

// ------------------------------------------
//  USER
// ------------------------------------------

var checkUser = function(config){
  
  get('', config, function(json){
    
    // A TTS means an error
    if (json.tts){ return log(json.tts); }
    
    // User alread exists
    if (!(json instanceof Array)){ validUser = true; return; }
    
    // Create a new user 
    set(false, {
      
      'devicetype' : 'SARAH',
      'username'   : config.username
      
    }, config, function(json){
      
      if (json.tts || json[0].error){
        log(json.tts || json[0].error.description)
      } else {
        validUser = true;
        log("User created");
      }
      
    });
  });
}

// ------------------------------------------
//  NETWORK
// ------------------------------------------

var log = function(msg){
  winston.log('info', '[HUE] ' + msg);
}

var get = function(path, config, callback){
  req(path, {}, config, callback)
}

var set = function(path, body, config, callback){
  req(path, { 'method': 'post', 'body': JSON.stringify(body) }, config, callback)
}

var put = function(path, body, config, callback){
  req(path, { 'method': 'put', 'body': JSON.stringify(body) }, config, callback)
}

var req = function(path, data, config, callback){
  
  data.uri  = 'http://'+config.ip+'/api' + (path !== false ? '/'+config.username+'/'+path : '');
  data.json = true;
  
  request(data, function (err, response, json){

    if (err || response.statusCode != 200) { 
      if (callback) callback({'tts': "Impossible de commander le pont HUE"});
      return;
    }
    
    if (callback) callback(json);
  });
  
}

// ------------------------------------------
//  COLOR ALGORITHM
// ------------------------------------------

var cc  = require('./lib/colorconverter').cc;
var rgbToHSLAndXY = function(hex, data){
  if (!hex) return false;
  
  // Algorithm 1 : RGB to XY + BRI 
  var xyb   = cc.hexStringToXyBri(hex);
  var color = cc.xyBriForModel(xyb, 'LCT001');
  // data.bri  = Math.round(color.bri * 255);
  data.xy   = [color.x, color.y];

  // Algorithm 2 : RGB to HSL 
  var hsl = rgbToHsv(parseInt(hex.substr(0,2), 16),
                     parseInt(hex.substr(2,2), 16),
                     parseInt(hex.substr(4,2), 16));
  
  // data.hue  = Math.round(hsl[0] * 65535);
  data.bri  = Math.round(hsl[2] * 255);
  data.sat  = Math.round(hsl[1] * 255);
  
  return true;
}

var rgbToHsl = function(r, g, b){
  r /= 255, g /= 255, b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if(max == min){
      h = s = 0; // achromatic
  } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
  }
  return [h, s, l];
}

function rgbToHsv(r, g, b){
    r = r/255, g = g/255, b = b/255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max == 0 ? 0 : d / max;

    if(max == min){
        h = 0; // achromatic
    }else{
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, v];
}


