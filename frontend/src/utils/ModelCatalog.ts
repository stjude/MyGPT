// Use backend-issued dataset IDs so namespaced model IDs never become paths.
const datasets = new Map<string, string>()
let provider = 'ollama'

export function rememberModelCatalog(data: {provider?: string; models: any[]}) {
  provider = data.provider || 'ollama'
  datasets.clear()
  for (const model of data.models) {
    if (model.direct_chat_dataset) datasets.set(model.name, model.direct_chat_dataset)
  }
}

export const directChatDataset = (model: string) => datasets.get(model) || model + '_direct_chat'
export const translationModel = (selected: string) => provider === 'ollama' ? 'translategemma:latest' : selected
