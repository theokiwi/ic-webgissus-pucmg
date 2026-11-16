import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaginaComponent } from '../../shared/pagina.component';

@Component({
  selector: 'app-privacidade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PaginaComponent, RouterLink],
  template: `
    <app-pagina>
      <article class="texto">
        <h1>Privacidade</h1>
        <p class="muted">Como o WebGIS SUS-MG trata os seus dados, em linha com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).</p>

        <h2>Sua localização</h2>
        <p>
          A função “perto de mim” só pede a posição do seu aparelho quando você toca no botão, e o navegador pede a sua
          permissão antes. A posição é enviada ao servidor <b>apenas para fazer a consulta</b> (buscar os estabelecimentos
          mais próximos ou calcular uma rota) e <b>não é armazenada</b>: não a gravamos em banco de dados, arquivo ou registro
          de uso. Você pode negar a permissão e continuar usando o mapa normalmente, escolhendo o município.
        </p>

        <h2>Cadastro e dados pessoais</h2>
        <p>Não há cadastro, login nem formulário. Não pedimos nome, e-mail, telefone ou documento. Os dados exibidos são do cadastro público de estabelecimentos (CNES) e do IBGE.</p>

        <h2>Cookies e rastreamento</h2>
        <p>
          Não usamos cookies de rastreamento, publicidade nem ferramentas de análise de terceiros. O navegador pode guardar
          arquivos do próprio aplicativo (cache do PWA) para que o site carregue mais rápido e funcione com conexão ruim; eles
          não identificam você e podem ser apagados nas configurações do navegador. Quando você chega por um link de
          divulgação ou compartilhamento, a aba guarda uma marca temporária (apagada ao fechá-la) para não contar o mesmo
          acesso duas vezes se a página for recarregada.
        </p>

        <h2>Links compartilhados e contagem de acessos</h2>
        <p>
          Quando você usa o botão “Compartilhar”, o link gerado ganha parâmetros <code>utm_source</code>,
          <code>utm_medium=social</code> e <code>utm_campaign=compartilhar</code>, que indicam por qual rede o link foi enviado.
          Os links de divulgação do projeto (Instagram, WhatsApp e o QR code dos cartazes) levam parâmetros parecidos, com
          <code>utm_campaign=divulgacao</code>. A navegação normal não leva nenhum deles.
        </p>
        <p>
          Quando o site é aberto por um desses links, ele soma <b>+1</b> num contador do dia para aquela origem (por
          exemplo, “cartaz” ou “whatsapp”). <b>Só isso é guardado</b>: data, origem, meio e campanha. Não registramos endereço
          IP, aparelho, página visitada, localização nem qualquer identificador, e não usamos cookies para isso, então não é
          possível saber quem acessou. A contagem serve apenas para saber quais formas de divulgação funcionam.
        </p>

        <h2>Serviços de terceiros</h2>
        <p>
          O mapa base é servido pelo OpenFreeMap (dados do OpenStreetMap). Ao carregar o mapa, o seu navegador faz requisições
          a esse serviço, que pode registrar o endereço IP conforme a política dele.
        </p>
        <p>
          Na busca por <b>bairro ou endereço</b>, o texto que você digita é enviado pelo <b>nosso servidor</b> ao Photon
          (komoot), um buscador de endereços sobre dados do OpenStreetMap. O seu endereço IP não é repassado a ele, e não
          guardamos o que foi pesquisado. A busca por município é feita no próprio aparelho e não sai dele. Ao compartilhar em uma rede social, você
          passa a estar sujeito à política de privacidade dessa rede.
        </p>

        <h2>Seus direitos e contato</h2>
        <p>
          Como não mantemos dados pessoais seus, não há o que corrigir ou excluir em nossos sistemas. Dúvidas sobre este
          projeto de pesquisa podem ser enviadas à equipe pelo repositório do projeto. Veja também a página
          <a routerLink="/sobre">Sobre</a>.
        </p>
      </article>
    </app-pagina>
  `,
  styles: `
    .texto { max-width: 760px; margin: 0 auto; padding: 1.5rem 1rem 1rem; line-height: 1.65; font-size: 1.0625rem; }
    h1 { font-size: 2rem; margin: 0.5rem 0; }
    h2 { font-size: 1.3125rem; margin: 2rem 0 0.25rem; }
    code { background: var(--destaque); padding: 0 0.25rem; border-radius: 4px; font-size: 0.9375em; }
    a { color: #0d47a1; }
  `,
})
export class PrivacidadeComponent {}
