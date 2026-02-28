export const convertSenseNovaMessage = (content: any) => {
  // If content is a single string, convert the format to text type
  if (typeof content === 'string') {
    return [{ text: content, type: 'text' }];
  }

  // If content is empty or not an array, return an empty array to avoid subsequent errors
  if (!Array.isArray(content)) {
    return [];
  }

  // If content includes image content, format conversion is needed for array-type content
  return content
    .map((item: any) => {
      // If the item is null/undefined, skip processing
      if (!item) return null;

      // If it is content text, convert the format to text type
      if (item.type === 'text') return item;

      // If it is image_url, convert the format to image_url type
      if (item.type === 'image_url' && item.image_url) {
        const url = item.image_url.url;

        // Ensure the URL exists and is a string
        if (!url || typeof url !== 'string') return null;

        // If image_url is in base64 format, return image_base64 type; otherwise return image_url type
        return url.startsWith('data:image/jpeg;base64') || url.startsWith('data:image/png;base64')
          ? {
              image_base64: url.split(',')[1],
              type: 'image_base64',
            }
          : { image_url: url, type: 'image_url' };
      }

      return null;
    })
    .filter(Boolean);
};
