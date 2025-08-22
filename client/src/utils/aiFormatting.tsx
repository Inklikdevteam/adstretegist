// Unified AI content formatting utility for all components

// Enhanced function to format AI responses with comprehensive markdown-like formatting
export const formatAIContent = (content: string) => {
  if (!content) return content;
  
  // Split content into lines for processing
  const lines = content.split('\n');
  const formattedLines = lines.map((line, index) => {
    // Convert markdown headers with improved styling
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-lg font-semibold mt-4 mb-2 text-gray-800 border-b border-gray-200 pb-1">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-xl font-bold mt-5 mb-3 text-gray-900 border-b-2 border-blue-500 pb-2">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className="text-2xl font-bold mt-6 mb-4 text-gray-900 border-b-2 border-blue-600 pb-2">{line.replace('# ', '')}</h1>;
    }
    
    // Convert bullet points with enhanced styling
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={index} className="flex items-start ml-1 my-3 p-4 bg-gradient-to-r from-blue-50 to-gray-50 rounded-lg border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-blue-600 mr-3 mt-1 text-lg font-bold">•</span>
          <span className="flex-1 text-gray-800">{formatInlineText(line.replace(/^[•-]\s+/, ''))}</span>
        </div>
      );
    }
    
    // Convert numbered lists with enhanced styling
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <div key={index} className="flex items-start ml-1 my-3 p-4 bg-gradient-to-r from-green-50 to-gray-50 rounded-lg border-l-4 border-green-500 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-green-700 mr-3 font-bold min-w-[2.5rem] bg-green-200 px-3 py-1 rounded-full text-center text-sm shadow-sm">{line.match(/^\d+/)?.[0]}</span>
          <span className="flex-1 text-gray-800">{formatInlineText(numberedMatch[1])}</span>
        </div>
      );
    }
    
    // Handle action types (Change/Wait/Clarify) with special styling
    if (line.match(/^(✅|⏳|❓)\s*(Change|Wait|Clarify|Apply change|Wait and monitor|Ask for clarification)/i)) {
      const actionMatch = line.match(/^(✅|⏳|❓)\s*(.*)/);
      if (actionMatch) {
        const [, emoji, text] = actionMatch;
        const colorClass = emoji === '✅' ? 'from-green-100 to-green-50 border-green-500' 
                        : emoji === '⏳' ? 'from-yellow-100 to-yellow-50 border-yellow-500'
                        : 'from-purple-100 to-purple-50 border-purple-500';
        return (
          <div key={index} className={`flex items-center p-4 bg-gradient-to-r ${colorClass} rounded-lg border-l-4 shadow-sm my-3`}>
            <span className="text-2xl mr-3">{emoji}</span>
            <span className="font-semibold text-gray-900">{formatInlineText(text)}</span>
          </div>
        );
      }
    }
    
    // Skip empty lines with controlled spacing
    if (line.trim() === '') {
      return <div key={index} className="h-3"></div>;
    }
    
    // Regular paragraphs with improved spacing and typography
    return <p key={index} className="my-3 text-gray-700 leading-relaxed text-base">{formatInlineText(line)}</p>;
  });
  
  return <div className="space-y-2">{formattedLines}</div>;
};

// Enhanced inline text formatting with better visual styling
export const formatInlineText = (text: string) => {
  if (!text) return text;
  
  // Split by **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-gray-900 bg-yellow-200 px-2 py-1 rounded-md shadow-sm">{part.slice(2, -2)}</strong>;
    }
    
    // Handle ₹ currency formatting with enhanced styling
    const currencyFormatted = part.replace(/₹(\d+(?:,\d+)*(?:\.\d+)?)/g, '<span class="font-bold text-green-800 bg-green-200 px-2 py-1 rounded-md shadow-sm border border-green-300">₹$1</span>');
    if (currencyFormatted !== part) {
      return <span key={index} dangerouslySetInnerHTML={{ __html: currencyFormatted }} />;
    }
    
    // Handle percentages with styling
    const percentFormatted = part.replace(/(\d+(?:\.\d+)?)%/g, '<span class="font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-md">$1%</span>');
    if (percentFormatted !== part) {
      return <span key={index} dangerouslySetInnerHTML={{ __html: percentFormatted }} />;
    }
    
    return part;
  });
};

// Simplified formatting for chat messages
export const formatChatMessage = (content: string) => {
  if (!content) return content;
  
  // Split content into lines for processing
  const lines = content.split('\n');
  const formattedLines = lines.map((line, index) => {
    // Convert markdown headers
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-base font-semibold mt-3 mb-2 text-gray-800">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-lg font-bold mt-4 mb-2 text-gray-900">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className="text-xl font-bold mt-4 mb-3 text-gray-900">{line.replace('# ', '')}</h1>;
    }
    
    // Convert bullet points with chat-appropriate styling
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={index} className="flex items-start ml-2 my-2 p-2 bg-gray-50 rounded">
          <span className="text-primary mr-2 mt-1 font-bold">•</span>
          <span className="flex-1">{formatInlineText(line.replace(/^[•-]\s+/, ''))}</span>
        </div>
      );
    }
    
    // Convert numbered lists
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <div key={index} className="flex items-start ml-2 my-2 p-2 bg-blue-50 rounded">
          <span className="text-primary mr-2 font-medium bg-blue-200 px-2 py-1 rounded text-sm">{line.match(/^\d+\./)?.[0]}</span>
          <span className="flex-1">{formatInlineText(numberedMatch[1])}</span>
        </div>
      );
    }
    
    // Empty lines for spacing
    if (line.trim() === '') {
      return <br key={index} />;
    }
    
    // Regular paragraphs
    return <p key={index} className="my-2 text-gray-700">{formatInlineText(line)}</p>;
  });
  
  return <div className="space-y-1">{formattedLines}</div>;
};