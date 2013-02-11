'use strict';
var fs = require( 'fs' );

var template = {};
var output = '';
var cRegEx = /\{#(if|else(\s?if)|end\sif)(\s([^\}]+))?\}/ig;
var vRegEx = /\{([^#\}\|]+)\}/g;
var ffRegEx = /\{(?=\w+\|)([^\|]+)\|(filter|format):([^\}]+)\}/ig;
var isIf = /if/i;
var isElse = /else/i;
var isEnd = /end/i;
var isFilter = /filter/i;

var clone = (function doClone( ) {
  function Clone(){}
  return function( obj ) {
    Clone.prototype = obj;
    return new Clone();
  };
})();

function cloneArray( arr ) {
  var a = new Array( arr.length );
  for ( var i = arr.length-1; i > -1; i-- ) {
    a[i] = clone( arr[i] );
  }
  return a;
}

function File( data ) {
  var keys = {};
  var safeData = ''+data;
  
  var vals = safeData.trim().replace( /[\r\n]/g, '=' ).split( '=' );
  vals.forEach( function trimWhitespace( val, idx ) {
    vals[idx] = vals[idx].trim();
  } );
  var i = 0;
  var l = vals.length;
  while ( i < l ) {
    if ( vals[i].length > 0 ) {
      keys[ vals[i].replace( /'/g, '' ) ] = vals[i+1] || '';
      i+=2;
    } else {
      i++;
    }
  }
  
  function doFilter( filter, val ) {
    var v = val;
    switch ( filter.toLowerCase() ) {
      case 'lowercase':
        v = v.toLowerCase();
        break;
      default:
        break;
    }
    return v;
  }
  
  function doFormat( format, val ) {
    var v = val;
    switch ( format.toLowerCase() ) {
      case 'date':
        var d = new Date( parseInt( v, 10 ) );
        v = d.toDateString();
        break;
      case 'phone':
        v = v.replace( /(\d)(\d{3})(\d{3})(\d{4})/, '($2) $3-$4' );
        break;
      default:
        break;
    }
    return v;
  }
  
  this.fromTemplate = function fromTemplate( t ) {
    var str = t.compiled;
    var tests = cloneArray( t.testFor );
    var vars = cloneArray( t.vars );
    var filters = cloneArray( t.filters );
    var formats = cloneArray( t.formats );
    var use = null;
    var rmv = {start:-1,end:0};
    var a = '';
    var b = '';
    var c = '';
    var i = 0;
    var l = 0;
    var j = 0;
    var k = 0;
    var m = 0;
    
    //  Replace conditionals first
    for ( i = 0, l = tests.length; i < l; i++ ) {
      if ( isEnd.test( tests[i].type ) ) {
        rmv.end = tests[i].index + tests[i].length;
        a = str.substring( 0, rmv.start );
        b = str.substr( rmv.end );
        var plen = str.length;
        var ostr = str;
        str = a + (use||'') + b;
        
        var diff = plen - str.length;
        var tdiff;
        
        for ( j = i+1; j < l; j++ ) {
          tests[j].index = tests[j].index - diff;
        }
        
        for ( k = 0, m = vars.length; k < m; k++ ) {
          if ( vars[k].index > rmv.start ) {
            if ( vars[k].index < rmv.end ) {
              tdiff = (ostr.indexOf( vars[k].raw, rmv.start ) - rmv.start) - (str.indexOf( vars[k].raw, rmv.start ) - rmv.start);
              vars[k].index -= tdiff;
            } else {
              vars[k].index -= diff;
            }
          }
        }
        
        for ( k = 0, m = filters.length; k < m; k++ ) {
          if ( filters[k].index > rmv.start ) {
            if ( filters[k].index < rmv.end ) {
              tdiff = (ostr.indexOf( filters[k].raw, rmv.start ) - rmv.start) - (str.indexOf( filters[k].raw, rmv.start ) - rmv.start);
              filters[k].index -= tdiff;
            } else {
              filters[k].index -= diff;
            }
          }
        }
        
        for ( k = 0, m = formats.length; k < m; k++ ) {
          if ( formats[k].index > rmv.start ) {
            if ( formats[k].index < rmv.end ) {
              tdiff = (ostr.indexOf( formats[k].raw, rmv.start ) - rmv.start) - (str.indexOf( formats[k].raw, rmv.start ) - rmv.start);
              formats[k].index -= tdiff;
            } else {
              formats[k].index -= diff;
            }
          }
        }
        
        //  Reset
        rmv.start = -1;
        use = null;
        break;
      } else if ( isIf.test( tests[i].type ) ) {
        if ( rmv.start === -1 ) {
          rmv.start = tests[i].index;
        }
        if ( keys[ tests[i].key ] && !use ) {
          use = str.substr( tests[i].index + tests[i].length, tests[i].value.length );
        }
      } else {
        if ( !use ) {
          use = str.substr( tests[i].index + tests[i].length, tests[i].value.length );
        }
      }
    }
    
    var vi = 0;
    var vl = 0;
    var vk = '';
    
    //  Replace vars
    for ( i = 0, l = vars.length; i < l; i++ ) {
      vk = keys[ vars[i].key ];
      if ( vk !== undefined && str.indexOf( vars[i].raw ) > -1 ) {
        vi = vars[i].index || 0;
        vl = vars[i].length || 0;
        a = str.substring( 0, vi );
        b = str.substr( vi + vl );
        str = a + vk + b;
        
        for ( j = i+1; j < l; j++ ) {
          vars[j].index = t.vars[j].index - vl + vk.length;
        }
        
        for ( k = 0, m = filters.length; k < m; k++ ) {
          if ( filters[k].index > vi ) {
            filters[k].index = filters[k].index - vl + vk.length;
          }
        }
        
        for ( k = 0, m = formats.length; k < m; k++ ) {
          if ( formats[k].index > vi ) {
            formats[k].index = formats[k].index - vl + vk.length;
          }
        }
      }
    }
    
    //  Replace filters
    for ( i = 0, l = filters.length; i < l; i++ ) {
      vk = keys[ filters[i].key ];
      if ( vk !== undefined && str.indexOf( filters[i].raw ) > -1 ) {
        vi = filters[i].index || 0;
        vl = filters[i].length || 0;
        a = str.substring( 0, vi );
        c = str.substr( vi + vl );
        b = doFilter( filters[i].filter, vk );
        str = a + b + c;
        
        for ( j = i+1; j < l; j++ ) {
          if ( filters[j].index > vi ) {
            filters[j].index = filters[j].index - vl + b.length;
          }
        }
        
        for ( k = 0, m = formats.length; k < m; k++ ) {
          if ( formats[k].index > vi ) {
            formats[k].index = formats[k].index - vl + b.length;
          }
        }
      }
    }
    
    //  Replace formats
    for ( i = 0, l = formats.length; i < l; i++ ) {
      vk = keys[ formats[i].key ];
      if ( vk !== undefined && str.indexOf( formats[i].raw ) > -1 ) {
        vi = formats[i].index || 0;
        vl = formats[i].length || 0;
        a = str.substring( 0, vi );
        c = str.substr( vi + vl );
        b = doFormat( formats[i].format, vk );
        str = a + b + c;
        
        for ( j = i+1; j < l; j++ ) {
          if ( formats[j].index > vi ) {
            formats[j].index = formats[j].index - vl + b.length;
          }
        }
      }
    }
    
    return str;
  };
}

function Template( data ) {
  var safeData = ''+data,
    self = this;
  
  this.testFor = [];
  this.filters = [];
  this.formats = [];
  this.vars = [];
  
  safeData.replace( vRegEx, function generateVars( match, p1, offset ) {
    self.vars.push( {key:p1, index:offset, length:match.length, raw:match} );
    return match;
  } );
  
  safeData.replace( ffRegEx, function generateFiltersFormats( match, p1, p2, p3, offset ) {
    if ( isFilter.test( p2 ) ) {
      self.filters.push( {key:p1, filter:p3, index:offset, length:match.length, raw:match} );
    } else {
      self.formats.push( {key:p1, format:p3, index:offset, length:match.length, raw:match} );
    }
    return match;
  } );
  
  safeData.replace( cRegEx, function generateTestFor( match, p1, p2, p3, p4, offset ) {
    self.testFor.push( {type: p1, key:p4||'', index:offset, length:match.length, value:'', raw:match} );
    return match;
  } );
  
  this.compiled = safeData;
  
  var c_prev = null;
  
  this.testFor.forEach( function populateTestFor( val ) {
    if ( isEnd.test( val.type ) ) {
      c_prev.value = self.compiled.substring( c_prev.index + c_prev.length, val.index );
    } else if ( isElse.test( val.type ) ) {
      c_prev.value = self.compiled.substring( c_prev.index + c_prev.length, val.index );
    }
    c_prev = val;
  } );
}

function processFolder( path ) {
  var contents = fs.readdirSync( path );
  contents.forEach( processFile );
}

function processFile( path ) {
  var stat = fs.statSync( path );
  
  if ( stat.isDirectory() ) {
    processFolder( path );
  } else if ( stat.isFile() ) {
    var data = fs.readFileSync( path );
    var file = new File( data );
    var fpath = output + path.substr( path.lastIndexOf( '/' ) + 1 );
    fs.writeFileSync( fpath, file.fromTemplate( template ) );
  }
}

process.argv.forEach( function handleArguments( val, idx ) {
  //  node
  //  file.js
  //  template
  //  output dir
  //  input dir
  
  var path = '';
  
  if ( idx > 1 ) {
    path = fs.realpathSync( val );
  }
  
  switch ( idx ) {
    case 0:
    case 1:
      break;
    case 2:
      template = new Template( fs.readFileSync( path ) );
      break;
    case 3:
      output = path + '/';
      break;
    default:
      processFile( path );
      break;
  }
} );