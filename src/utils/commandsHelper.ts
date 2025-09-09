import type { APIApplicationCommandInteraction, APIChatInputApplicationCommandInteractionData } from 'discord-api-types/v10'
import { ADMIN_COMMANDS } from '@/discord/adminCommands'
import { COMMANDS } from '@/discord/commands'

export function findHandlerByName(name: string) {
  return COMMANDS.find(c => c.command.name.toLowerCase() === name.toLowerCase())?.handler || ADMIN_COMMANDS.find(c => c.command.name.toLowerCase() === name.toLowerCase())?.handler
}

export function findModalSubmitHandlerByName(name: string) {
  return COMMANDS.map(c => c.modalSubmitHandlers?.[name.toLowerCase()]).find(Boolean) || ADMIN_COMMANDS.map(c => c.modalSubmitHandlers?.[name.toLowerCase()]).find(Boolean)
}

export function findAutoCompleteHandlerByName(name: string) {
  return COMMANDS.find(c => c.command.name.toLowerCase() === name.toLowerCase())?.autoCompleteHandler || ADMIN_COMMANDS.find(c => c.command.name.toLowerCase() === name.toLowerCase())?.autoCompleteHandler
}

export function findMessageComponentHandlerByName(name: string) {
  return COMMANDS.map(c => c.messageComponentHandlers?.[name.toLowerCase()]).find(Boolean) || ADMIN_COMMANDS.map(c => c.messageComponentHandlers?.[name.toLowerCase()]).find(Boolean)
}

export function getSubcommandInfo(interaction: APIApplicationCommandInteraction) {
  const data = interaction.data

  if (!data || data.type !== 1)
    return { subcommandGroup: undefined, subcommand: undefined, commandName: data.name }

  const chatData = data as APIChatInputApplicationCommandInteractionData

  const subcommandGroup = chatData.options?.find(opt => opt.type === 2)?.name
  const subcommand = chatData.options?.find(opt => opt.type === 1)?.name || chatData.options?.find(opt => opt.type === 2)?.options?.find(opt => opt.type === 1)?.name

  return { subcommandGroup, subcommand, commandName: data.name }
}
