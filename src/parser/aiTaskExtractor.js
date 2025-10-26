/**
 * AI-based task extraction using Claude API
 *
 * This replaces the regex-based extractAtomicActions() with actual semantic understanding.
 * Uses Claude to read recipe paragraphs and extract atomic cooking tasks.
 */

/**
 * Extracts atomic tasks from a recipe section using Claude API.
 *
 * @param {string} sectionText - The recipe paragraph to analyze
 * @returns {Promise<Array<string>>} Array of atomic task descriptions
 */
export async function extractAtomicTasksWithAI(sectionText) {
  const prompt = `You are a recipe parser. Extract atomic cooking tasks from this recipe paragraph.

Rules:
1. Each task should be ONE discrete action (e.g., "Add onion", "Stir until smooth")
2. Split compound sentences into separate tasks
3. Convert gerunds to imperatives (e.g., "stirring" → "Stir")
4. Keep timing info with the relevant task (e.g., "Cook for 5 minutes")
5. Return ONLY a JSON array of task strings, nothing else

Example input:
"Add the onion and garlic, cooking until they become light golden and softened, approximately three minutes."

Example output:
["Add the onion and garlic", "Cook until light golden and softened (3 minutes)"]

Now extract tasks from this paragraph:
${sectionText}

Return JSON array only:`;

  try {
    // Use Claude API for actual semantic understanding
    // NOTE: API key should be stored in environment variable, not hardcoded
    const API_KEY = process.env.ANTHROPIC_API_KEY || 'YOUR_API_KEY_HERE';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const tasksText = data.content[0].text;

    // Extract JSON array from response (Claude might wrap it in markdown)
    const jsonMatch = tasksText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const tasks = JSON.parse(jsonMatch[0]);
      console.log('✅ Claude API extracted', tasks.length, 'atomic tasks');
      return tasks;
    } else {
      console.warn('⚠️ Could not parse JSON from Claude response, using fallback');
      return mockAIExtraction(sectionText);
    }
  } catch (error) {
    console.error('❌ AI task extraction failed:', error);
    // Fallback to mock implementation
    console.log('↪️ Using fallback mock extraction');
    return mockAIExtraction(sectionText);
  }
}

/**
 * Mock AI extraction for development (mimics what Claude would do)
 * This implements reasonable task splitting logic until we have actual AI calls.
 */
function mockAIExtraction(text) {
  const tasks = [];

  // Split by periods first
  const sentences = text.split(/\.\s+/).filter(s => s.trim().length > 0);

  for (const sentence of sentences) {
    // Look for obvious compound tasks
    // Pattern: "action, VERBing" → split into ["action", "VERB"]
    const gerundMatch = sentence.match(/^(.+?),\s+([a-z]+ing\b.+)$/i);
    if (gerundMatch) {
      const firstPart = gerundMatch[1].trim();
      let secondPart = gerundMatch[2].trim();

      // Convert gerund to imperative
      secondPart = secondPart.replace(/^([a-z]+ing)\b/i, (match) => {
        let stem = match.replace(/ing$/i, '').toLowerCase();
        // Handle doubled consonants: "stirring" → "stir"
        if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) {
          stem = stem.slice(0, -1);
        }
        return stem.charAt(0).toUpperCase() + stem.slice(1);
      });

      tasks.push(firstPart);
      tasks.push(secondPart);
      continue;
    }

    // Pattern: "action, then action" → split
    const thenMatch = sentence.match(/^(.+?),\s+then\s+(.+)$/i);
    if (thenMatch) {
      tasks.push(thenMatch[1].trim());
      tasks.push(thenMatch[2].trim());
      continue;
    }

    // Pattern: "action, action, then action" → split
    const multiMatch = sentence.match(/^(.+?),\s+(.+?),\s+then\s+(.+)$/i);
    if (multiMatch) {
      tasks.push(multiMatch[1].trim());
      tasks.push(multiMatch[2].trim());
      tasks.push(multiMatch[3].trim());
      continue;
    }

    // No pattern matched - keep whole sentence
    tasks.push(sentence.trim());
  }

  // Clean up trailing punctuation
  return tasks.map(task => {
    return task
      .replace(/[,;]+$/, '')  // Remove trailing commas/semicolons
      .trim();
  }).filter(t => t.length > 0);
}
