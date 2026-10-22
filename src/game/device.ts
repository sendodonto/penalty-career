/** Tela de toque como entrada principal (celular/tablet): troca as dicas de teclado e aumenta os alvos. */
export const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
