'use strict';

var fs = require( 'fs' );

var Template = (function createTemplate() {
  /**
  * Object to represent variable, filter, and format holders in the template
  * 
  * @arg index int Offset from beginning of template.
  * @arg data String The complete text of the holder.
  */
  function Piece( index, data ) {
    var self = this;
    var targetKeyRegExp = /(\{(?!#)([^\|]+)\|(?:f(?:ilter|ormat)\:)([^\}]+)\})/ig;
    var filterFormatRegExp = /f(ilter|ormat)/i;
    var filterRegExp = /filter/i;
    var formatRegExp = /format/i;
    
    /**
    * Apply filter to raw input
    * 
    * @arg raw String Raw input.
    */
    function filter( raw ) {
      switch( self.target.toLowerCase() ) {
        case 'lowercase':
          return raw.toLowerCase();
        default:
          return raw;
      }
    }
    
    /**
    * Apply format to raw input.
    * 
    * @arg raw String Raw input.
    */
    function format( raw ) {
      switch ( self.target.toLowerCase() ) {
        case 'date':
          var d = new Date( parseInt( raw, 10 ) );
          return d.toDateString();
        case 'phone':
          return raw.replace( /(\d)(\d{3})(\d{3})(\d{4})/, '($2) $3-$4' );
        default:
          return raw;
      }
    }
    
    /**
    * Publicly accessible variables
    * 
    * @var index int The offset from the beginning of the template.
    * @var rawData String The original and complete holder's text.
    * @var type String The type of the Piece object. Either 'filter', 'format', or 'var'.
    * @var target String The filter or format to be applied. Will be 'none' for type 'var'.
    * @var key String The name of the variable to use to replace this holder's text with upon export.
    */
    this.index = index;
    this.rawData = data;
    
    this.type = filterRegExp.test( data ) ? 'filter' : formatRegExp.test( data ) ? 'format' : 'var';
    this.target = filterFormatRegExp.test( this.type ) ? data.replace( targetKeyRegExp, '$3' ) : 'none';
    this.key = filterFormatRegExp.test( this.type ) ? data.replace( targetKeyRegExp, '$2' ) : data.replace( /\{(?!#)([^\}]+)\}/, '$1' );
    
    /**
    /* Generate and return the end value for this Piece
    /* 
    /* @arg raw String The raw data to use.
    /*/
    this.returnValue = function returnValue( raw ) {
      if ( filterRegExp.test( self.type ) ) {
        return filter( raw );
      } else if ( formatRegExp.test( self.type ) ) {
        return format( raw );
      } else {
        return raw;
      }
    };
  }
  
  /**
  * Object to represent conditional blocks in the template
  * 
  * @arg index int Offset from beginning of template.
  * @arg data String The complete text of the holder.
  */
  function Block( index, data ) {
    var self = this;
    var conditionalKeyValueRegExp = /\{#(if|else(?:\sif)?)(?:\s([^\}]+))?\}[\r\n]((?:[^\{]+))/gi;
    
    /**
    * Publicly accessible variables
    * 
    * @var index int The offset from the beginning of the template.
    * @var rawData String The original and complete holder's text.
    * @var conditions Array The list of conditions to test for in this Block
    */
    this.index = index;
    this.rawData = data;
    
    this.conditions = [];
    
    this.rawData.replace( conditionalKeyValueRegExp, function populateConditions( match, p1, p2, p3, offset ) {
      self.conditions.push( {index: offset, type: p1, key: p2||'', value:p3} );
      return match;
    } );
    
    this.conditions.sort( function sortOnIndex( a, b ) {
      var ai = parseInt( a.index, 10 );
      var bi = parseInt( b.index, 10 );
      if ( ai < bi ) {
        return -1;
      } else if ( bi < ai ) {
        return 1;
      }
      return 0;
    } );
    
    /**
    /* Generate and return the end value for this Block
    /* 
    /* @arg keys Object The key value map, in the format key[ name ] = value.
    /*/
    this.returnValue = function returnValue( keys ) {
      var elseRegExp = /else(?!\sif)/i;
      for ( var i = 0, l = self.conditions.length; i < l; i++ ) {
        var condition = self.conditions[i];
        if ( !elseRegExp.test( condition.type ) ) {
          if ( keys[ condition.key ] !== undefined ) {
            return condition.value;
          }
        } else {
          return condition.value;
        }
      }
      return '';
    };
  }
  
  /**
  * Internal type of Template. Has all functionality and capabilities of Template as
  * it's used to return a fully instantiated object to the Template var.
  */
  function _Template() {
    var self = this;
    
    function sortOnIndex( a, b ) {
      var ai = parseInt( a.index, 10 ),
        bi = parseInt( b.index, 10 );
      if ( ai < bi ) {
        return -1;
      } else if ( bi > ai ) {
        return 1;
      }
      return 0;
    }
    
    /**
    * Publicly accessible variables
    * 
    * @var rawData String The original and complete holder's text.
    * @var pieces Array The list of Piece objects for the template.
    * @var blocks Array The list of Block objects for the template.
    * @var outputDir String The path of the output directory.
    */
    this.rawData = '';
    this.pieces = [];
    this.blocks = [];
    
    this.outputDir = '';
    
    /**
    /* Consume raw template data and find all the Piece objects that will be used.
    /* Purposefully hold off from finding the Block objects until the Piece objects have
    /* supplied their end values in order to prevent messy atomic operations.
    /* 
    /* @arg data String The raw template text.
    /*/
    this.process = function process( data ) {
      var roughVarRegExp = /(\{(?!#)([^\}]+)\})/g;
      
      self.rawData = data;
      
      data.replace( roughVarRegExp, function populatePieces( match, p1, p2, offset ) {
        self.pieces.push( new Piece( offset, match ) );
        return match;
      } );
      
      self.pieces.sort( sortOnIndex );
    };
    
    /**
    /* Using data file, export newly merged file.
    /* After swapping all applicable Piece objects (from the end of the template to the beginning),
    /* find and swap the Block objects.
    /* 
    /* @arg data String The raw data text.
    /* @arg filename String The name of the file to be exported.
    /*/
    this.exportUsingDataFile = function( data, filename ) {
      var keys = {length:0};
      var str = self.rawData;
      
      data.replace( /^([^=\r\n]*)=([^\r\n]*)/gm, function populateKeys( match, p1, p2 ) {
        var tp1 = (p1||'').trim();
        var tp2 = (p2||'').trim();
        if ( tp1.length > 0 ) {
          keys[tp1] = tp2;
          keys.length++;
        }
        return match;
      } );
      
      if ( keys.length === 0 ) {
        //  No keys, no export
        return;
      }
      
      var i = 0;
      for ( i = self.pieces.length-1; i > -1; i-- ) {
        var piece = self.pieces[i];
        if ( keys[ piece.key ] !== undefined ) {
          var val = piece.returnValue( keys[ piece.key ] );
          str = str.substring( 0, piece.index ) + val + str.substr( piece.index + piece.rawData.length );
        }
      }
      
      self.blocks = [];
      
      var conditionalIndex = str.indexOf( '{#if', 0 );
      while ( conditionalIndex > -1 ) {
        var endIndex = str.indexOf( '{#end if}', conditionalIndex);
        //  10 is length of {#end if} + line ending
        var match = str.substring( conditionalIndex, endIndex + 10 );
        self.blocks.push( new Block( conditionalIndex, match ) );
        conditionalIndex = str.indexOf( '{#if', endIndex );
      }
      
      self.blocks.sort( sortOnIndex );
      
      for ( i = self.blocks.length-1; i > -1; i-- ) {
        var block = self.blocks[i];
        str = str.substring( 0, block.index ) + block.returnValue( keys ) + str.substr( block.index + block.rawData.length );
      }
      
      fs.writeFile( self.outputDir + filename, str, function handleWrittenFile( err ) {
        if ( err ) {
          process.stderr( 'Could not write file: ' + (self.outputDir + filename) );
        }
      } );
    };
  }
  
  return new _Template();
})();

process.argv.forEach( function handleArguments( val, idx ) {
  /**
  * Format the arguments come in:
  * 
  * node
  * filename.js
  * template file
  * output dir
  * input dir
  */
  
  var path = '';
  
  if ( idx > 1 ) {
    path = fs.realpathSync( val );
  }
  
  switch ( idx ) {
    case 0:
    case 1:
      break;
    case 2:
      Template.process( fs.readFileSync( path ).toString() );
      break;
    case 3:
      Template.outputDir = path + '/';
      break;
    default:
      fs.readFile( path, function handleReadFile( err, data ) {
        if ( err ) {
          process.stderr( 'Could not read file: ' + path );
        }
        Template.exportUsingDataFile( data.toString(), path.substr( path.lastIndexOf( '/' ) ) );
      } );
      break;
  }
} );