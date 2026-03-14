export default async function handler(req, res) {
  const { username, userid } = req.query;
  
  if (!username && !userid) {
    return res.status(400).json({ error: 'Username or Pilot ID is required' });
  }

  let url;
  if (userid) {
    url = `https://www.simbrief.com/api/xml.fetcher.php?userid=${userid.trim()}&json=v2`;
  } else {
    url = `https://www.simbrief.com/api/xml.fetcher.php?username=${username.trim()}&json=v2`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // SimBrief identifies errors in the JSON response even with HTTP 200
    if (data.fetch && data.fetch.status === 'error') {
      return res.status(404).json(data);
    }
    
    res.status(200).json(data);
  } catch (error) {
    console.error('SimBrief proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch SimBrief data from proxy' });
  }
}
