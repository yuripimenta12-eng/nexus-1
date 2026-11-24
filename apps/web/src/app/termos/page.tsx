import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaLegal, CONTATO, RESPONSAVEL, CIDADE_UF } from '@/components/legal/pagina-legal';

export const metadata: Metadata = { title: 'Termos de Uso · Nexus', description: 'Regras de uso do Nexus.' };

export default function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso">
      <p>
        Estes Termos explicam as regras para usar o <strong>Nexus</strong> (site nexuslink.art e app de PC), um serviço de
        chamadas de voz, vídeo, transmissão de tela, mensagens e comunidades. O Nexus é mantido por {RESPONSAVEL}, pessoa
        física, de {CIDADE_UF} (&quot;nós&quot;). Ao criar uma conta ou usar o Nexus, você concorda com estes Termos e com a{' '}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>1. Quem pode usar</h2>
      <ul>
        <li>O Nexus é <strong>só para maiores de 18 anos</strong>. Ao criar a conta, você declara ter 18 anos ou mais.</li>
        <li>Se soubermos que uma conta é de menor de 18 anos, ela será encerrada.</li>
        <li>Cada conta é de uma pessoa. Você é responsável pela sua senha e por tudo o que acontece na sua conta. Recomendamos ligar a verificação em duas etapas.</li>
      </ul>

      <h2>2. Regras de convivência</h2>
      <p>No Nexus é proibido:</p>
      <ul>
        <li>Qualquer conteúdo ou conduta ilegal.</li>
        <li><strong>Qualquer conteúdo de abuso ou exploração sexual de crianças e adolescentes.</strong> Tolerância zero: a conta é banida e o caso é comunicado às autoridades.</li>
        <li>Assédio, ameaças, perseguição, discurso de ódio ou discriminação.</li>
        <li>Divulgar conteúdo íntimo ou dados pessoais de alguém sem autorização.</li>
        <li>Gravar ou divulgar chamadas de outras pessoas sem o consentimento delas.</li>
        <li>Spam, golpes, links maliciosos, se passar por outra pessoa ou pela equipe do Nexus.</li>
        <li>Atacar, invadir ou sobrecarregar o Nexus, usar robôs sem autorização ou burlar limites, planos ou pagamentos.</li>
        <li>Vender, comprar ou trocar contas, Nex, Prisma ou itens fora do Nexus.</li>
      </ul>

      <h2>3. O que você publica</h2>
      <ul>
        <li>Mensagens, arquivos, fotos e transmissões que você envia são de sua responsabilidade e continuam sendo seus.</li>
        <li>Para o Nexus funcionar, você nos permite guardar e mostrar esse conteúdo para as pessoas com quem você escolheu compartilhar (por exemplo, os membros de um servidor ou a pessoa da conversa).</li>
        <li>Os servidores (comunidades) têm donos e cargos que também moderam o que acontece neles.</li>
        <li>Para denunciar uma mensagem ou uma pessoa, avise o dono do servidor ou escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a> (se puder, com um print).</li>
      </ul>

      <h2>4. Moderação</h2>
      <p>
        Quando uma regra é quebrada, podemos remover conteúdo, avisar, suspender ou banir a conta, conforme a gravidade.
        Se você achar que foi um engano, escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a> pedindo revisão.
      </p>

      <h2>5. Planos pagos (Nexus+ e Nexus Pro)</h2>
      <ul>
        <li>Os planos são pagos por <strong>Pix</strong>, com o preço mostrado no site no momento da compra.</li>
        <li>Cada compra vale pelo período escolhido (30 dias ou 1 ano), contado a partir da confirmação do Pix. <strong>Não há renovação automática</strong>: nada é cobrado depois.</li>
        <li>Se você comprar o mesmo plano enquanto ele ainda vale, os dias se somam.</li>
        <li>Os benefícios de cada plano estão descritos na página de planos e podem mudar; mudanças importantes serão avisadas no Nexus e não tiram benefícios de um período já pago.</li>
      </ul>

      <h2>6. Nex, Prisma e itens</h2>
      <ul>
        <li><strong>Nex</strong> é a moeda grátis do Nexus, ganha usando o app. Não tem valor em dinheiro e não pode ser comprada nem trocada por dinheiro.</li>
        <li><strong>Prisma</strong> é a moeda comprada com Pix. Ela só serve dentro do Nexus, não vira dinheiro, não vira Nex e não pode ser passada para outra pessoa.</li>
        <li>Molduras, ícones, efeitos e outros itens são uma licença de uso dentro do Nexus, ligada à sua conta.</li>
        <li>As caixas mostram tudo o que vem dentro: <strong>não há sorteio</strong> em nada pago com dinheiro.</li>
      </ul>

      <h2>7. Direito de arrependimento e reembolso</h2>
      <ul>
        <li>Pelo Código de Defesa do Consumidor (art. 49), você pode <strong>desistir da compra em até 7 dias</strong> depois do pagamento.</li>
        <li>Basta escrever para <a href={`mailto:${CONTATO}`}>{CONTATO}</a> com o número do pedido (aparece no comprovante da tela de pagamento). Devolvemos o valor pago por Pix.</li>
        <li>Com o reembolso, o plano é encerrado e a Prisma comprada (ou os itens comprados com ela) é retirada da conta.</li>
        <li>Fora desse prazo, também devolvemos o valor se a compra não foi entregue por falha nossa.</li>
      </ul>

      <h2>8. Doações</h2>
      <p>
        Doações são voluntárias, ajudam a manter o Nexus no ar e <strong>não dão nada em troca</strong>. Doou o valor errado
        ou por engano? Escreva em até 7 dias que devolvemos.
      </p>

      <h2>9. App de PC</h2>
      <ul>
        <li>O app de PC se atualiza sozinho (a partir da versão 1.5.0).</li>
        <li>Para mostrar &quot;Jogando&quot; no seu perfil, o app verifica quais jogos estão abertos no computador. Só o nome do jogo reconhecido é enviado. Para desligar, use a opção &quot;Mostrar o jogo que estou jogando&quot; no menu do ícone do Nexus, perto do relógio do Windows.</li>
      </ul>

      <h2>10. Funcionamento do serviço</h2>
      <p>
        Fazemos o possível para o Nexus funcionar bem, mas ele pode ter falhas, ficar fora do ar para manutenção ou mudar
        funções. Não nos responsabilizamos por conteúdo publicado por outras pessoas nem por perdas causadas por uso
        indevido da sua conta por falta de cuidado com a senha, nos limites permitidos pela lei.
      </p>

      <h2>11. Encerrar a conta</h2>
      <p>
        Você pode excluir sua conta quando quiser, em Configurações. A exclusão é definitiva e o que acontece com os seus
        dados está na <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>12. Marca e conteúdo do Nexus</h2>
      <p>O nome Nexus, o logotipo, as artes, molduras e sons do app pertencem ao Nexus e não podem ser copiados para outros fins.</p>

      <h2>13. Mudanças nestes Termos</h2>
      <p>
        Se mudarmos algo importante, avisamos no próprio Nexus e pedimos que você aceite de novo. A data da versão fica no
        topo desta página.
      </p>

      <h2>14. Lei aplicável</h2>
      <p>
        Estes Termos seguem as leis do Brasil. Em caso de disputa, vale o foro do seu domicílio, como prevê o Código de
        Defesa do Consumidor.
      </p>
    </PaginaLegal>
  );
}
