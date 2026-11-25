import type { Metadata } from 'next';
import Link from 'next/link';
import { PaginaLegal, CONTATO, RESPONSAVEL, CIDADE_UF } from '@/components/legal/pagina-legal';

export const metadata: Metadata = { title: 'Política de Privacidade · Nexus', description: 'Como o Nexus trata os seus dados pessoais.' };

export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade">
      <p>
        Esta Política explica quais dados pessoais o <strong>Nexus</strong> (nexuslink.art e app de PC) coleta, para quê,
        com quem compartilha, por quanto tempo guarda e quais são os seus direitos pela Lei Geral de Proteção de Dados
        (LGPD, Lei 13.709/2018).
      </p>

      <h2>1. Quem cuida dos seus dados</h2>
      <p>
        O controlador dos dados é {RESPONSAVEL}, pessoa física, de {CIDADE_UF}. Para qualquer assunto sobre privacidade,
        fale com a gente em <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>

      <h2>2. Quais dados coletamos</h2>
      <ul>
        <li><strong>Cadastro:</strong> nome de exibição, nome de usuário (@), e-mail e senha. A senha é guardada de forma embaralhada (hash): nem nós conseguimos lê-la.</li>
        <li><strong>Perfil:</strong> foto, capa, bio, status, jogos e conexões que você escolher mostrar, molduras e itens.</li>
        <li><strong>O que você envia:</strong> mensagens, arquivos, imagens, áudios, reações, servidores, amigos e bloqueios.</li>
        <li><strong>Chamadas e transmissões de tela:</strong> passam pelo nosso servidor em tempo real para chegar às outras pessoas, mas <strong>não são gravadas</strong>.</li>
        <li><strong>Endereço IP:</strong> usado na hora para fazer a conexão funcionar e para proteger contra abusos (como muitas tentativas de senha). <strong>Não fica guardado na sua conta.</strong> Os registros técnicos do servidor podem conter IPs por um tempo, para segurança e para corrigir problemas.</li>
        <li><strong>App de PC:</strong> a versão do app e, se a opção &quot;Mostrar o jogo que estou jogando&quot; estiver ligada, o nome do jogo aberto (some 3 minutos depois de fechar o jogo). Para a conquista &quot;Tempo de jogo&quot;, guardamos só o <strong>total de minutos</strong> jogados, sem o nome dos jogos.</li>
        <li><strong>Notificações:</strong> se você ativar, o endereço de notificação do seu navegador.</li>
        <li><strong>Pagamentos por Pix:</strong> o que foi comprado, o valor, a data e o código da transação. <strong>Não recebemos dados do seu banco, cartão ou senha.</strong> O pagamento é feito no app do seu banco e processado pelo Efí Bank.</li>
        <li><strong>Economia do app:</strong> saldo e histórico de Nex e Prisma, itens, missões e conquistas.</li>
        <li><strong>Moderação:</strong> denúncias, avisos e punições ligadas à conta.</li>
      </ul>
      <p>Não usamos ferramentas de análise de comportamento nem anúncios, e não vendemos dados.</p>

      <h2>3. Para que usamos e com qual base legal</h2>
      <ul>
        <li><strong>Fazer o Nexus funcionar</strong> (conta, chamadas, mensagens, perfil, planos e compras): execução do contrato com você (LGPD, art. 7º, V).</li>
        <li><strong>Guardar os dados das compras:</strong> cumprimento de obrigação legal (art. 7º, II; Código de Defesa do Consumidor e regras fiscais).</li>
        <li><strong>Segurança, prevenção de golpes e moderação:</strong> legítimo interesse (art. 7º, IX) e proteção dos outros usuários.</li>
        <li><strong>Notificações e &quot;Jogando&quot;:</strong> só se você ligar, e você pode desligar quando quiser.</li>
      </ul>

      <h2>4. Com quem compartilhamos</h2>
      <p>Só com os serviços necessários para o Nexus funcionar:</p>
      <ul>
        <li><strong>Hostinger</strong> (Brasil): servidor onde ficam o banco de dados, os arquivos e as chamadas.</li>
        <li><strong>Vercel</strong> (EUA): hospeda as páginas do site.</li>
        <li><strong>Efí Bank</strong> (Brasil): processa os pagamentos por Pix.</li>
        <li><strong>Brevo</strong> (França): envia e-mails de confirmação de conta e de troca de senha.</li>
        <li><strong>Telegram</strong>: guarda uma cópia de segurança diária <strong>criptografada</strong>, que o Telegram não consegue ler.</li>
        <li><strong>GitHub</strong> (EUA): de onde o app de PC é baixado e atualizado.</li>
        <li><strong>YouTube e SoundCloud</strong>: quando alguém pede uma música ao DJ, o texto da busca é enviado a eles.</li>
        <li><strong>Serviço de notificações do seu navegador</strong> (Google, Mozilla, Microsoft ou Apple), se você ativar as notificações.</li>
      </ul>
      <p>
        Alguns desses serviços ficam fora do Brasil. Nesses casos, a transferência acontece para executar o contrato com
        você e com as garantias da LGPD (art. 33). Também podemos fornecer dados a autoridades quando a lei ou uma ordem
        judicial exigir.
      </p>
      <p>
        O que você publica em servidores e conversas é visto pelas pessoas que estão neles. Seu perfil (nome, foto, capa,
        bio, conquistas e plano) pode ser visto por outros usuários do Nexus.
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <ul>
        <li><strong>Conta, perfil e mensagens:</strong> enquanto a conta existir, ou até você apagar a mensagem.</li>
        <li><strong>Compras:</strong> até 5 anos, para cumprir obrigações do consumidor e fiscais.</li>
        <li><strong>Fotos e capas trocadas:</strong> a anterior é apagada na hora.</li>
        <li><strong>Cópias de segurança:</strong> 14 dias, criptografadas.</li>
      </ul>
      <p>
        <strong>Ao excluir a conta</strong> (em Configurações), apagamos seus dados pessoais, fotos, arquivos e mensagens
        diretas. Sobra apenas um registro anônimo (&quot;Conta removida&quot;, sem nome, e-mail ou foto), necessário para
        manter registros de moderação e de compras. Dados que a lei manda guardar ficam pelo prazo da lei.
      </p>

      <h2>6. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode pedir a qualquer momento:</p>
      <ul>
        <li>confirmação de que tratamos seus dados e uma cópia deles;</li>
        <li>correção de dados errados (boa parte você mesmo edita no perfil);</li>
        <li>exclusão dos dados (você mesmo pode excluir a conta em Configurações);</li>
        <li>informação sobre com quem compartilhamos;</li>
        <li>revogação de consentimentos (por exemplo, desligar notificações ou o &quot;Jogando&quot;).</li>
      </ul>
      <p>
        Escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>. Respondemos em até 15 dias. Você também pode reclamar
        na Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>7. Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), senhas embaralhadas, verificação em duas etapas opcional, servidor com acesso
        restrito e cópias de segurança criptografadas. Nenhum sistema é 100% invulnerável: se acontecer um incidente que
        coloque seus dados em risco, avisaremos você e a ANPD, como manda a lei.
      </p>

      <h2>8. Cookies e armazenamento no navegador</h2>
      <p>
        Usamos apenas o necessário para você continuar conectado e lembrar suas preferências (como volume e modo leve).
        Não usamos cookies de propaganda nem de rastreamento.
      </p>

      <h2>9. Menores de idade</h2>
      <p>
        O Nexus é só para maiores de 18 anos e não coleta dados de crianças e adolescentes de propósito. Se descobrirmos
        uma conta de menor, ela será encerrada e os dados, apagados.
      </p>

      <h2>10. Mudanças nesta Política</h2>
      <p>
        Se mudarmos algo importante, avisamos no Nexus e pedimos um novo aceite. Veja também os{' '}
        <Link href="/termos">Termos de Uso</Link>.
      </p>
    </PaginaLegal>
  );
}
