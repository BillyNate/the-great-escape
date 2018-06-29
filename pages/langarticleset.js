/**
 * Replaces a keyword in a string and also set the correct article
 *
 * Replaces a keyword by looking the given keyword prefixed by $
 * Also replaces instances of the keyword prefixed by & and postfixed by ^ for an article fron the articles parameter. By adding an asterisk (*) to the keyword the articles object will traverse to the attribute followed by the star. By adding a hashtag (#) to the keyword the articles object will traverse to the attribute matching the value of the attribute in the word object that follows the #.
 * There an example object containing sentences, articles and words in the code file.
 *
 * @param {string} text - The string containing the keyword
 * @param {object} articles - Object containing all possible articles. The function will traverse through this object
 * @param {object} word - Object containing the word at key `word` and other optional attributes
 * @param {string} keyword - The keyword the function replaces, without the prefix
 */
function langArticleSet(text, articles, word, keyword)
{
  text = text.replace('$' + keyword, word.word);

  text = text.replace(new RegExp('&' + keyword + '[a-zA-Z0-9\*#_]*%', 'g'), function(match, offset, string)
  {
  	var matches = match.match(/[\*#][a-zA-Z0-9_]+/g),
        result = articles;
    for(var i in matches)
    {
      if(matches[i][0] == '*')
      {
      	result = result[matches[i].substr(1)];
      }
      else if(matches[i][0] == '#')
      {
      	result = result[word[matches[i].substr(1)]];
      }
    }
    return result;
  });
  return text;
}

/*
 * Anonymous object containing some samples:
 */

/*
{
  en: {
    articles: {
      d: { a: 'the', an: 'the' },
      i: { a: 'a', an: 'an' }
    },
    words: {
      tree: { ana: 'a', word: 'tree' },
      knife: { ana: 'a', word: 'knife' },
      olive: { ana: 'an', word: 'olive' }
    },
    sentences: {
      nearby: 'I\'m nearby &1*d#ana% $1',
      would_like: 'Would you like &1*i#ana% $1'
    }
  },
  nl: {
    articles: {
      d: { m: 'de', f: 'de', n: 'het', p: 'de' },
      i: { m: 'een', f: 'een', n: 'een', p: 'de' }
    },
    words: {
      tree: { gender: 'm', word: 'boom' },
      knife: { gender: 'n', word: 'mes' },
      olive: { gender: 'f', word: 'olijf' }
    },
    sentences: {
      nearby: 'Ik ben in de buurt van &1*d#gender% $1',
      would_like: 'Zou je &1*i#gender% $1 willen?'
    }
  },
  de: {
    articles: {
      d: {
        m: { n: 'der', a: 'das', d: 'die', g: 'die' },
        f: { n: 'den', a: 'das', d: 'die', g: 'die' },
        n: { n: 'dem', a: 'dem', d: 'der', g: 'den' },
        p: { n: 'des', a: 'des', d: 'der', g: 'der' }
      },
      i: {
        m: { n: 'ein', a: 'ein', d: 'eine', g: 'eine' },
        f: { n: 'einen', a: 'ein', d: 'eine', g: 'eine' },
        n: { n: 'einem', a: 'einem', d: 'einer', g: 'einen' },
        p: { n: 'eines', a: 'eines', d: 'einer', g: 'einer' }
      }
    },
    words: {
      tree: { gender: 'm', word: 'Baum' },
      knife: { gender: 'n', word: 'Messer' },
      olive: { gender: 'f', word: 'Olive' }
    },
    sentences: {
      nearby: 'Ich bin in de nähe von &1*d#gender*n% $1',
      would_like: 'Wolst du &1*i#gender*n% $1?'
    }
  }
}
*/