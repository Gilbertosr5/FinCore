import { getFromState, getSafeRedirectPath } from './safe-redirect';

describe('getSafeRedirectPath (proteção contra open redirect)', () => {
  it('aceita caminhos internos com query e hash', () => {
    expect(getSafeRedirectPath('/orcamentos')).toBe('/orcamentos');
    expect(getSafeRedirectPath({ pathname: '/contas', search: '?id=1', hash: '#x' })).toBe(
      '/contas?id=1#x',
    );
  });

  it.each([
    'https://malicioso.com',
    '//malicioso.com',
    '/\\malicioso.com',
    'javascript:alert(1)',
    'orcamentos',
    '/contas\n',
    '',
  ])('rejeita destino inseguro %j', (from) => {
    expect(getSafeRedirectPath(from)).toBe('/dashboard');
  });

  it('não redireciona de volta para telas de autenticação ou raiz', () => {
    expect(getSafeRedirectPath('/entrar')).toBe('/dashboard');
    expect(getSafeRedirectPath('/sessao-expirada?x=1')).toBe('/dashboard');
    expect(getSafeRedirectPath('/')).toBe('/dashboard');
  });

  it('usa o fallback para valores desconhecidos', () => {
    expect(getSafeRedirectPath(undefined)).toBe('/dashboard');
    expect(getSafeRedirectPath(42, '/configuracoes')).toBe('/configuracoes');
  });

  it('lê state.from com segurança', () => {
    expect(getFromState({ from: '/x' })).toBe('/x');
    expect(getFromState(null)).toBeUndefined();
    expect(getFromState('texto')).toBeUndefined();
  });
});
