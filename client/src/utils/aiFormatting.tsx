// Simple AI content formatting utility for all components

// Simple formatting for AI responses
export const formatAIContent = (content: string) => {
  if (!content) return content;
  
  // Split content into lines for processing
  const lines = content.split('\n');
  const formattedLines = lines.map((line, index) => {
    // Convert headers
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-base font-semibold mt-3 mb-2 text-gray-800">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-lg font-semibold mt-4 mb-2 text-gray-900">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className="text-xl font-semibold mt-4 mb-3 text-gray-900">{line.replace('# ', '')}</h1>;
    }
    
    // Convert bullet points
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={index} className="flex items-start my-2">
          <span className="text-gray-600 mr-2 mt-1">•</span>
          <span className="flex-1 text-gray-700">{formatInlineText(line.replace(/^[•-]\s+/, ''))}</span>
        </div>
      );
    }
    
    // Convert numbered lists
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <div key={index} className="flex items-start my-2">
          <span className="text-gray-600 mr-2 font-medium">{line.match(/^\d+\./)?.[0]}</span>
          <span className="flex-1 text-gray-700">{formatInlineText(numberedMatch[1])}</span>
        </div>
      );
    }
    
    // Skip empty lines
    if (line.trim() === '') {
      return <br key={index} />;
    }
    
    // Regular paragraphs
    return <p key={index} className="my-2 text-gray-700">{formatInlineText(line)}</p>;
  });
  
  return <div className="space-y-1">{formattedLines}</div>;
};

// Simple inline text formatting
export const formatInlineText = (text: string) => {
  if (!text) return text;
  
  // Split by **bold** patterns
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    
    // Handle currency formatting
    const currencyFormatted = part.replace(/₹(\d+(?:,\d+)*(?:\.\d+)?)/g, '<span class="font-medium text-green-700">₹$1</span>');
    if (currencyFormatted !== part) {
      return <span key={index} dangerouslySetInnerHTML={{ __html: currencyFormatted }} />;
    }
    
    return part;
  });
};

// Simple chat message formatting
export const formatChatMessage = (content: string) => {
  if (!content) return content;
  
  // Split content into lines for processing
  const lines = content.split('\n');
  const formattedLines = lines.map((line, index) => {
    // Convert headers
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-base font-semibold mt-3 mb-2 text-gray-800">{line.replace('### ', '')}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-lg font-semibold mt-3 mb-2 text-gray-900">{line.replace('## ', '')}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className="text-xl font-semibold mt-3 mb-2 text-gray-900">{line.replace('# ', '')}</h1>;
    }
    
    // Convert bullet points
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={index} className="flex items-start my-1">
          <span className="text-gray-500 mr-2 mt-1">•</span>
          <span className="flex-1 text-gray-700">{formatInlineText(line.replace(/^[•-]\s+/, ''))}</span>
        </div>
      );
    }
    
    // Convert numbered lists
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <div key={index} className="flex items-start my-1">
          <span className="text-gray-500 mr-2">{line.match(/^\d+\./)?.[0]}</span>
          <span className="flex-1 text-gray-700">{formatInlineText(numberedMatch[1])}</span>
        </div>
      );
    }
    
    // Empty lines for spacing
    if (line.trim() === '') {
      return <br key={index} />;
    }
    
    // Regular paragraphs
    return <p key={index} className="my-1 text-gray-700">{formatInlineText(line)}</p>;
  });
  
  return <div className="space-y-1">{formattedLines}</div>;
};