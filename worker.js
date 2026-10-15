const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.endsWith('/api/ai')&&request.method==='POST'){
      const provider=env.DEEPSEEK_API_KEY?'deepseek':env.OPENAI_API_KEY?'openai':null;
      if(!provider)return json({error:'AI 服务尚未配置，请先在 Cloudflare 中设置 DEEPSEEK_API_KEY。'},503);
      let body;
      try{body=await request.json()}catch{return json({error:'请求格式不正确。'},400)}
      const {tool='interpret',lesson={},period='第一课时',level='普通班级',prompt=''}=body||{};
      if(typeof prompt!=='string'||prompt.length>6000)return json({error:'输入内容不能超过 6000 字。'},400);
      const toolNames={interpret:'教材解读',objectives:'教学目标',process:'教学流程',questions:'问题链',worksheet:'学习任务单',assessment:'课堂评价',homework:'分层作业',reflection:'教学反思'};
      const input=`请完成“${toolNames[tool]||'智能备课'}”任务。\n\n课文：${lesson.title||'未指定'}\n年级与版本：统编小学语文二年级上册（2025修订版）\n课时：${period}\n班级情况：${level}\n文体：${lesson.genre||'待核对'}\n单元语文要素：${lesson.unitElement||'待核对'}\n本课重点：${lesson.focus||'待核对'}\n本课难点：${lesson.difficulty||'待核对'}\n教师要求：${prompt||'请按当前信息给出可执行方案'}\n\n请使用清晰的Markdown标题和表格。每项建议写清“教师怎么做、学生怎么学、如何判断达成”。不得虚构课文原文、生字、课后题或官方出处；资料不足时标注“需教师依据正版教材核对”。结尾附“教师复核清单”。`;
      try{
        const gatewayId=env.AI_GATEWAY_ID||'default';
        const deepseekUrl=env.CLOUDFLARE_ACCOUNT_ID?`https://gateway.ai.cloudflare.com/v1/${env.CLOUDFLARE_ACCOUNT_ID}/${gatewayId}/deepseek/chat/completions`:'https://api.deepseek.com/chat/completions';
        const apiUrl=provider==='deepseek'?deepseekUrl:'https://api.openai.com/v1/responses';
        const apiKey=provider==='deepseek'?env.DEEPSEEK_API_KEY:env.OPENAI_API_KEY;
        const model=provider==='deepseek'?(env.DEEPSEEK_MODEL||'deepseek-flash'):(env.OPENAI_MODEL||'gpt-5.5');
        const system='你是严谨的小学语文教研员。面向中国小学语文教师提供适龄、循证、可执行的备课建议。区分教材事实、教研判断和AI建议，所有输出标注“AI生成待审核”。';
        const payload=provider==='deepseek'?{model,messages:[{role:'system',content:system},{role:'user',content:input}],thinking:{type:'disabled'},max_tokens:3000,stream:false}:{model,instructions:system,input,reasoning:{effort:'none'},max_output_tokens:3000,store:false};
        const controller=new AbortController();
        let timeoutId;
        const timeout=new Promise((_,reject)=>{timeoutId=setTimeout(()=>{controller.abort();reject(new DOMException('AI gateway timeout','TimeoutError'))},45000)});
        const response=await Promise.race([fetch(apiUrl,{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},signal:controller.signal,body:JSON.stringify(payload)}),timeout]);
        clearTimeout(timeoutId);
        const raw=await response.text();
        let data;
        try{data=JSON.parse(raw)}catch{data={}}
        if(!response.ok){const detail=data?.error?.message||data?.errors?.[0]?.message||data?.message||raw.slice(0,300)||'模型服务请求失败。';const code=data?.error?.code||data?.errors?.[0]?.code||`http_${response.status}`;console.error('DeepSeek upstream error',{status:response.status,requestId:response.headers.get('x-request-id'),code,detail});return json({error:`DeepSeek上游返回 ${response.status}：${detail}`,code,requestId:response.headers.get('x-request-id'),upstream:'cloudflare-ai-gateway'},response.status)}
        const text=provider==='deepseek'?(data.choices?.[0]?.message?.content||''):(data.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n');
        return json({text,responseId:data.id,model:data.model,provider});
      }catch(error){const timedOut=error?.name==='TimeoutError'||error?.name==='AbortError';console.error('AI request failed',{name:error?.name,message:error?.message});return json({error:timedOut?'DeepSeek生成超过45秒，已自动停止。请缩短要求后重试。':'暂时无法连接模型服务，请稍后重试。',code:timedOut?'upstream_timeout':'connection_failed'},timedOut?504:502)}
    }
    if(url.pathname.endsWith('/api/health'))return json({ok:true,aiConfigured:Boolean(env.DEEPSEEK_API_KEY||env.OPENAI_API_KEY),provider:env.DEEPSEEK_API_KEY?'deepseek':env.OPENAI_API_KEY?'openai':null,model:env.DEEPSEEK_API_KEY?(env.DEEPSEEK_MODEL||'deepseek-flash'):(env.OPENAI_MODEL||null),apiProtocol:env.DEEPSEEK_API_KEY?'chat-completions':'responses',upstream:env.DEEPSEEK_API_KEY?(env.CLOUDFLARE_ACCOUNT_ID?'cloudflare-ai-gateway':'direct'):'openai',gateway:env.CLOUDFLARE_ACCOUNT_ID?(env.AI_GATEWAY_ID||'default'):null,limits:{thinking:'disabled',maxOutputTokens:3000,timeoutSeconds:45},deployment:'worker-with-assets-v9'});
    return env.ASSETS.fetch(request);
  }
};
