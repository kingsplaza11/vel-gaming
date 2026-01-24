import { useEffect } from 'react';

// SEO configuration
const SEO_CONFIG = {
  default: {
    title: 'Veltora - Premium Crypto Gaming Platform | Play & Win Real Money',
    description: 'Experience the thrill of premium crypto gaming at Veltora. Play exciting casino games, slots, and skill-based games to win real money in Naira. Secure, fair, and entertaining gaming platform.',
    keywords: 'online casino, crypto gaming, slots games, real money games, Nigeria gaming, bitcoin games, cryptocurrency gaming, win real money, online betting',
    ogTitle: 'Veltora - Premium Crypto Gaming Platform',
    ogDescription: 'Play exciting casino games and win real money in Naira. Join Veltora today!',
    ogImage: '/images/veltora-og-image.jpg',
    ogUrl: 'https://veltora.com',
    twitterCard: 'summary_large_image',
    twitterSite: '@VeltoraGames',
    twitterCreator: '@VeltoraGames'
  },
  dashboard: {
    title: 'Dashboard | Veltora - Your Gaming Portal',
    description: 'Access all your favorite games, manage your balance, and track your winnings on Veltora dashboard.',
    ogTitle: 'Veltora Dashboard - Your Gaming Portal',
  },
  login: {
    title: 'Login | Veltora - Secure Access to Premium Gaming',
    description: 'Securely login to your Veltora account and access premium crypto gaming experiences.',
    ogTitle: 'Login to Veltora - Premium Gaming Platform',
  },
  register: {
    title: 'Register | Veltora - Join the Gaming Revolution',
    description: 'Create your Veltora account today and start playing exciting games to win real money in Naira.',
    ogTitle: 'Join Veltora - Premium Gaming Platform',
  },
  games: {
    slots: {
      title: 'Golden Slots | Spin & Win Real Money | Veltora',
      description: 'Play Golden Slots on Veltora! Spin the reels and win big with exciting bonus features and jackpots.',
      keywords: 'slots, slot machine, online slots, casino slots, win slots, slot games'
    },
    crash: {
      title: 'Crash Game | Bet & Cash Out | Veltora',
      description: 'Experience the adrenaline rush of Crash game on Veltora. Bet wisely and cash out at the right moment!',
      keywords: 'crash game, multiplier game, cash out game, betting game'
    },
    fishing: {
      title: 'Deep Sea Fishing | Catch Fish & Win | Veltora',
      description: 'Go deep sea fishing and catch valuable fish to win big prizes on Veltora gaming platform.',
      keywords: 'fishing game, arcade fishing, skill game, fish shooting'
    },
    treasure: {
      title: 'Treasure Hunt | Find Hidden Treasures | Veltora',
      description: 'Embark on a treasure hunt adventure! Find hidden treasures and win exciting rewards on Veltora.',
      keywords: 'treasure hunt, adventure game, puzzle game, hidden objects'
    },
    dragon: {
      title: 'Dragon Arena | Epic Battle Game | Veltora',
      description: 'Enter the Dragon Arena and battle mythical creatures to win legendary prizes on Veltora.',
      keywords: 'dragon game, battle game, fantasy game, adventure game'
    },
    miner: {
      title: 'Crypto Miner | Mine Cryptocurrency | Veltora',
      description: 'Play Crypto Miner game on Veltora and mine digital currency to win real rewards.',
      keywords: 'crypto miner, mining game, cryptocurrency, blockchain game'
    },
    space: {
      title: 'Space Explorer | Cosmic Adventure | Veltora',
      description: 'Explore the cosmos in Space Explorer game on Veltora gaming platform.',
      keywords: 'space game, exploration, adventure, cosmic'
    },
    potion: {
      title: 'Potion Brewing | Magic Alchemy Game | Veltora',
      description: 'Brew magical potions and create powerful concoctions in Potion Brewing game on Veltora.',
      keywords: 'potion, alchemy, magic game, fantasy'
    },
    pyramid: {
      title: 'Pyramid Adventure | Ancient Egypt Game | Veltora',
      description: 'Explore ancient pyramids and discover hidden treasures in Pyramid Adventure on Veltora.',
      keywords: 'pyramid, egypt, adventure, ancient'
    },
    heist: {
      title: 'Cyber Heist | Futuristic Heist Game | Veltora',
      description: 'Plan and execute the perfect cyber heist in this futuristic game on Veltora.',
      keywords: 'cyber heist, futuristic, strategy, heist game'
    },
    tower: {
      title: 'Tower Builder | Construction Game | Veltora',
      description: 'Build the tallest tower and test your engineering skills on Veltora.',
      keywords: 'tower builder, construction, building game'
    },
    cards: {
      title: 'Card Matcher | Memory Card Game | Veltora',
      description: 'Test your memory with the Card Matcher game on Veltora gaming platform.',
      keywords: 'card matcher, memory game, matching game'
    },
    clicker: {
      title: 'Speed Clicker | Fast Clicking Game | Veltora',
      description: 'How fast can you click? Challenge yourself with Speed Clicker on Veltora.',
      keywords: 'clicker game, speed game, clicking challenge'
    },
    colorswitch: {
      title: 'Color Switch | Color Matching Game | Veltora',
      description: 'Switch colors and match patterns in this exciting Color Switch game on Veltora.',
      keywords: 'color switch, color matching, pattern game'
    },
    guessing: {
      title: 'Number Guesser | Guess The Number | Veltora',
      description: 'Test your intuition with Number Guesser game on Veltora platform.',
      keywords: 'number guesser, guessing game, numbers'
    },
    minesweeper: {
      title: 'Minesweeper Treasure | Minefield Game | Veltora',
      description: 'Navigate through minefields and find treasures in Minesweeper on Veltora.',
      keywords: 'minesweeper, minefield, treasure hunt'
    }
  }
};

const SeoHead = ({ page, subpage = null, user = null }) => {
  useEffect(() => {
    let seoData = SEO_CONFIG.default;
    
    if (SEO_CONFIG[page]) {
      if (subpage && SEO_CONFIG[page][subpage]) {
        seoData = { ...SEO_CONFIG.default, ...SEO_CONFIG[page][subpage] };
      } else {
        seoData = { ...SEO_CONFIG.default, ...SEO_CONFIG[page] };
      }
    }

    const formattedTitle = user ? `${seoData.title} | Welcome ${user.username}` : seoData.title;
    
    // Update document title
    document.title = formattedTitle;
    
    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = seoData.description;
    
    // Update meta keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = seoData.keywords;
    
    // Update OG tags
    updateMetaTag('og:title', seoData.ogTitle || seoData.title);
    updateMetaTag('og:description', seoData.ogDescription || seoData.description);
    updateMetaTag('og:image', seoData.ogImage);
    
    // Update Twitter tags
    updateMetaTag('twitter:card', seoData.twitterCard);
    updateMetaTag('twitter:title', seoData.ogTitle || seoData.title);
    updateMetaTag('twitter:description', seoData.ogDescription || seoData.description);
    updateMetaTag('twitter:image', seoData.ogImage);
    
    // Add JSON-LD structured data
    addStructuredData(seoData);
    
  }, [page, subpage, user]);

  const updateMetaTag = (property, content) => {
    let metaTag = document.querySelector(`meta[property="${property}"]`) || 
                  document.querySelector(`meta[name="${property}"]`);
    
    if (!metaTag) {
      metaTag = document.createElement('meta');
      if (property.startsWith('og:')) {
        metaTag.setAttribute('property', property);
      } else if (property.startsWith('twitter:')) {
        metaTag.setAttribute('name', property);
      }
      document.head.appendChild(metaTag);
    }
    metaTag.content = content;
  };

  const addStructuredData = (seoData) => {
    // Remove existing structured data
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => {
      if (script.id === 'veltora-structured-data') {
        script.remove();
      }
    });
    
    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'veltora-structured-data';
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Veltora",
      "url": "https://veltora.com",
      "description": seoData.description,
      "applicationCategory": "GameApplication",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "NGN"
      },
      "creator": {
        "@type": "Organization",
        "name": "Veltora Gaming",
        "url": "https://veltora.com"
      },
      "keywords": seoData.keywords,
      "genre": ["Online Gaming", "Casino", "Skill Games", "Entertainment"],
      "datePublished": "2024-01-01",
      "dateModified": new Date().toISOString().split('T')[0]
    });
    
    document.head.appendChild(script);
  };

  return null; // This component doesn't render anything
};

export default SeoHead;