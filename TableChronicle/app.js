// 找到按钮
const countInput  = document.getElementById('dicecount');
const typeSelect  = document.getElementById('diceytpe');
const rollBtn  = document.getElementById('rolbtn');
const outputDiv  = document.getElementById('out');
const loadBtn   = document.getElementById('loadDataBtn');
const charList  = document.getElementById('charList');

loadBtn.addEventListener('click', function() {
    charList.innerHTML = '<li>⏳ 正在请求后端数据...</li>';

    fetch('/api/characters')
        .then(response => response.json())
        .then(data => {
            charList.innerHTML = '';
            data.characters.forEach(function(name) {
                charList.innerHTML += `<li>🎯 ${name}</li>`;
            });
        })
        .catch(error => {
            charList.innerHTML = `<li style="color:red;">❌ 请求失败：${error.message}</li>`;
        });
});





// 监听点击
rollBtn.addEventListener('click', function() {

    const count=parseInt(countInput.value);
    const sides=parseInt(typeSelect.value);
    let results=[];
    let sum=0;
    for(let i=0;i<count;i++){
        
        const roll=Math.floor(Math.random()*sides)+1;
        results.push(roll);
        sum += roll; 
      

    }
    outputDiv.innerHTML = '';
     if (count === 1) {
        outputDiv.textContent = '🎲 点数：' + sum;
    } else {
        // 掷了多次，显示每次的结果和总和（用 innerHTML 可以加粗和换行）
        outputDiv.innerHTML = 
            '📊 各次结果：' + results.join('、') + 
            '<br>➕ 总和：<strong>' + sum + '</strong>';
    }



});