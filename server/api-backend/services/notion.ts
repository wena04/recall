import { Client } from '@notionhq/client';

export async function createNotionPage(token: string, databaseId: string, title: string, summary: string): Promise<string | null> {
  const notion = new Client({ auth: token });

  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: { // 'Name' is the default title property
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: summary,
                },
              },
            ],
          },
        },
      ],
    });
    return response.id;
  } catch (error) {
    console.error('Error creating Notion page:', error);
    return null;
  }
}
